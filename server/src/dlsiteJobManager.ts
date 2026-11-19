import { randomUUID } from "node:crypto";
import type {
  DlsiteJobBulkProgress,
  DlsiteJobCodeState,
  DlsiteJobEvent,
  DlsiteJobOrigin,
  DlsiteJobSnapshot,
} from "@mimimilli/shared";
import type { DlsiteAdapter } from "./adapter/dlsite.ts";
import type { SseSubscription } from "./lib/sseStream.ts";
import { formatError, getCategoryLogger } from "./lib/logger.ts";

const dlsiteLogger = getCategoryLogger("dlsite");

type Listener = (event: DlsiteJobEvent) => void;

interface CodeEntry {
  origin: DlsiteJobOrigin;
  state: DlsiteJobCodeState;
  force: boolean;
  /** 取得中に単発で取り直しを求められた。走行中の試行を終端にせず、終わりしだい取り直す */
  refetch: boolean;
  /** 走行中の試行がforceで走っているか */
  attemptForce: boolean;
}

interface Job {
  jobId: string;
  status: "running" | "finished";
  codes: Map<string, CodeEntry>;
  queue: string[];
  controller: AbortController;
  listeners: Set<Listener>;
  loopStarted: boolean;
  /** 打ち切りで切り離された。以降このジョブのループは何も送出しない */
  detached: boolean;
}

export type DlsiteJobRequest =
  | { origin: "bulk"; productCodes: string[] }
  | { origin: "single"; productCode: string };

const isTerminalState = (state: DlsiteJobCodeState): boolean =>
  state === "fetched" || state === "not_found" || state === "failed";

/**
 * DLsite取得ジョブ。同時に1本だけ動き、実行中に受けた取得は同じジョブのキューへ合流する。
 * 起点（まとめて／単発）はproduct codeごとに持つ。永続化せず、サーバー再起動では再開しない。
 */
export class DlsiteJobManager {
  private readonly adapter: Pick<DlsiteAdapter, "fetchDlsiteProduct">;
  private job: Job | null = null;
  private loop: Promise<void> = Promise.resolve();
  private shuttingDown = false;

  constructor(adapter: Pick<DlsiteAdapter, "fetchDlsiteProduct">) {
    this.adapter = adapter;
  }

  /** 取得を積み、合流先を含むジョブIDを返す。終了処理中は積まずにnullを返す */
  start(request: DlsiteJobRequest): string | null {
    if (this.shuttingDown) return null;
    let job = this.job;
    if (!job || job.status === "finished") job = this.createJob();
    const codes =
      request.origin === "bulk" ? [...new Set(request.productCodes)] : [request.productCode];
    for (const code of codes) this.admit(job, code, request.origin);
    this.ensureLoop(job);
    return job.jobId;
  }

  getSnapshot(): DlsiteJobSnapshot | null {
    return this.job ? this.snapshotOf(this.job) : null;
  }

  /** 待機中・取得中のコードの状態。候補一覧が「取得中」を載せるために同期で読む */
  getInFlightState(productCode: string): "queued" | "fetching" | null {
    const entry = this.job?.status === "running" ? this.job.codes.get(productCode) : undefined;
    return entry && !isTerminalState(entry.state) ? (entry.state as "queued" | "fetching") : null;
  }

  /** 現在のsnapshotの取得とlistener登録を同期の1手で行う（ADR-0030） */
  subscribe(listener: Listener): SseSubscription<DlsiteJobEvent> {
    const job = this.job;
    const replay: DlsiteJobEvent[] = [{ type: "snapshot", job: this.getSnapshot() }];
    if (!job || job.status === "finished") {
      return { replay, live: false, unsubscribe: () => {} };
    }
    job.listeners.add(listener);
    return { replay, live: true, unsubscribe: () => job.listeners.delete(listener) };
  }

  /** 起点がまとめてで待機中のコードをキューから外す。取得中のコードと単発は止めない */
  cancelBulk(jobId: string): number {
    const job = this.job;
    if (!job || job.status !== "running" || job.jobId !== jobId) return 0;
    const removed: string[] = [];
    for (const [code, entry] of job.codes) {
      if (entry.origin === "bulk" && entry.state === "queued") removed.push(code);
    }
    if (removed.length === 0) return 0;
    const removedSet = new Set(removed);
    for (const code of removed) job.codes.delete(code);
    job.queue = job.queue.filter((code) => !removedSet.has(code));
    this.emit(job, {
      type: "removed",
      jobId,
      productCodes: removed,
      bulk: this.bulkProgress(job),
    });
    return removed.length;
  }

  /** root再設定・テストリセット用。キューを起点を問わず捨て、実行中の取得を打ち切って終了を待つ */
  async cancelActiveAndAwait(): Promise<void> {
    this.detach();
    await this.loop;
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    this.detach();
    try {
      await this.loop;
    } catch (error) {
      dlsiteLogger.error("DLsiteジョブの終了待機中にエラーが発生しました", formatError(error));
      throw error;
    }
  }

  private createJob(): Job {
    const job: Job = {
      jobId: randomUUID(),
      status: "running",
      codes: new Map(),
      queue: [],
      controller: new AbortController(),
      listeners: new Set(),
      loopStarted: false,
      detached: false,
    };
    this.job = job;
    return job;
  }

  private admit(job: Job, code: string, origin: DlsiteJobOrigin): void {
    const entry = job.codes.get(code);
    if (!entry) {
      const created: CodeEntry = {
        origin,
        state: "queued",
        force: origin === "single",
        refetch: false,
        attemptForce: false,
      };
      job.codes.set(code, created);
      this.enqueue(job, code, origin);
      this.emitCode(job, code, created);
      return;
    }
    if (entry.state === "queued") {
      if (origin === "single" && entry.origin === "bulk") {
        entry.origin = "single";
        entry.force = true;
        job.queue = job.queue.filter((queued) => queued !== code);
        this.enqueue(job, code, "single");
        this.emitCode(job, code, entry);
      } else if (origin === "single") {
        entry.force = true;
      }
      return;
    }
    if (entry.state === "fetching") {
      if (origin === "single") {
        entry.origin = "single";
        entry.force = true;
        if (!entry.attemptForce) entry.refetch = true;
        this.emitCode(job, code, entry);
      }
      return;
    }
    entry.origin = origin;
    entry.force = origin === "single";
    entry.state = "queued";
    this.enqueue(job, code, origin);
    this.emitCode(job, code, entry);
  }

  /** 単発は待機中の単発の末尾（まとめての前）、まとめては末尾へ入れる */
  private enqueue(job: Job, code: string, origin: DlsiteJobOrigin): void {
    if (origin === "bulk") {
      job.queue.push(code);
      return;
    }
    const firstBulk = job.queue.findIndex((queued) => job.codes.get(queued)?.origin === "bulk");
    if (firstBulk < 0) job.queue.push(code);
    else job.queue.splice(firstBulk, 0, code);
  }

  private ensureLoop(job: Job): void {
    if (job.loopStarted) return;
    job.loopStarted = true;
    const previous = this.loop;
    this.loop = this.runJob(job, previous);
  }

  private async runJob(job: Job, previous: Promise<void>): Promise<void> {
    await previous.catch(() => {});
    while (!job.detached) {
      const code = job.queue.shift();
      if (code === undefined) {
        this.finish(job, "complete");
        return;
      }
      const entry = job.codes.get(code);
      if (!entry) continue;
      entry.state = "fetching";
      this.emitCode(job, code, entry);
      let state: DlsiteJobCodeState = "failed";
      do {
        entry.refetch = false;
        entry.attemptForce = entry.force;
        try {
          const outcome = await this.adapter.fetchDlsiteProduct(code, {
            force: entry.force,
            signal: job.controller.signal,
          });
          state = outcome;
        } catch (error) {
          if (job.detached) return;
          dlsiteLogger.error("DLsite取得ジョブのコード処理に失敗しました", {
            productCode: code,
            ...formatError(error),
          });
          state = "failed";
        }
      } while (entry.refetch && !job.detached);
      if (job.detached) return;
      entry.state = state;
      this.emitCode(job, code, entry);
    }
  }

  private finish(job: Job, reason: "complete" | "aborted"): void {
    job.status = "finished";
    this.emit(job, { type: "finished", jobId: job.jobId, reason });
    job.listeners.clear();
  }

  /** 同期的に「キュー全破棄 → finished(aborted)送出 → 切り離し」まで行う */
  private detach(): void {
    const job = this.job;
    if (!job) return;
    job.queue.length = 0;
    if (job.status === "running") this.finish(job, "aborted");
    job.detached = true;
    job.controller.abort();
    this.job = null;
  }

  private emitCode(job: Job, productCode: string, entry: CodeEntry): void {
    this.emit(job, {
      type: "code",
      jobId: job.jobId,
      productCode,
      origin: entry.origin,
      state: entry.state,
      bulk: this.bulkProgress(job),
    });
  }

  private emit(job: Job, event: DlsiteJobEvent): void {
    for (const listener of job.listeners) listener(event);
  }

  private bulkProgress(job: Job): DlsiteJobBulkProgress {
    let processed = 0;
    let total = 0;
    for (const entry of job.codes.values()) {
      if (entry.origin !== "bulk") continue;
      total += 1;
      if (isTerminalState(entry.state)) processed += 1;
    }
    return { processed, total };
  }

  private snapshotOf(job: Job): DlsiteJobSnapshot {
    return {
      jobId: job.jobId,
      status: job.status,
      codes: [...job.codes].map(([productCode, entry]) => ({
        productCode,
        origin: entry.origin,
        state: entry.state,
      })),
      bulk: this.bulkProgress(job),
    };
  }
}
