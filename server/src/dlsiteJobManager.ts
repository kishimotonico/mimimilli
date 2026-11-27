import { randomUUID } from "node:crypto";
import type {
  DlsiteJobProgress,
  DlsiteJobCode,
  DlsiteJobCodeState,
  DlsiteJobEvent,
  DlsiteJobSnapshot,
  DlsiteJobState,
  DlsiteTerminalProductSummary,
} from "@mimimilli/shared";
import type { DlsiteAdapter } from "./adapter/dlsite.ts";
import type { SseSubscription } from "./lib/sseStream.ts";
import { formatError, getCategoryLogger } from "./lib/logger.ts";

const dlsiteLogger = getCategoryLogger("dlsite");

type Listener = (event: DlsiteJobEvent) => void;

interface CodeEntry {
  /** 終端でないときの状態。終端は result が持つ */
  state: "queued" | "fetching";
  /** 直近の取得の結果。待機・取得中に戻ったら null */
  result: DlsiteTerminalProductSummary | null;
  /** このコードが最後に変化した時点の revision */
  revision: number;
  force: boolean;
  /** 取得中に force で取り直しを求められた。走行中の試行を終端にせず、終わりしだい取り直す */
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

export interface DlsiteJobRequest {
  productCodes: string[];
  /** 失敗の記録と解析できないsnapshotを無視して取り直す */
  force?: boolean;
}

const phaseOf = (entry: CodeEntry): DlsiteJobCodeState => entry.result?.state ?? entry.state;

/**
 * DLsite取得ジョブ。同時に1本だけ動き、実行中に受けた取得は同じジョブのキューへ合流する。
 * 永続化せず、サーバー再起動では再開しない。
 */
export class DlsiteJobManager {
  private readonly adapter: Pick<DlsiteAdapter, "fetchDlsiteProduct">;
  private job: Job | null = null;
  private loop: Promise<void> = Promise.resolve();
  private shuttingDown = false;
  private readonly now: () => number;
  private current: number;

  constructor(
    adapter: Pick<DlsiteAdapter, "fetchDlsiteProduct">,
    options: { now?: () => number } = {},
  ) {
    this.adapter = adapter;
    this.now = options.now ?? Date.now;
    this.current = this.now() * 1000;
  }

  /**
   * クライアントに見える最新の状態の revision。プロセス全体で1つ数え、ジョブをまたいで単調に増える。
   * 現在時刻のマイクロ秒を下限にするのは、再起動をまたいでも前のプロセスの値を下回らないようにするため
   */
  get revision(): number {
    return this.current;
  }

  private bump(): number {
    this.current = Math.max(this.current + 1, this.now() * 1000);
    return this.current;
  }

  /** 取得を積み、積んだ後の状態を返す。終了処理中は積まずにnullを返す */
  start(request: DlsiteJobRequest): DlsiteJobState | null {
    if (this.shuttingDown) return null;
    let job = this.job;
    if (!job || job.status === "finished") job = this.createJob();
    const force = request.force === true;
    for (const code of new Set(request.productCodes)) this.admit(job, code, force);
    this.ensureLoop(job);
    return this.getState();
  }

  getState(): DlsiteJobState {
    return { revision: this.current, job: this.job ? this.snapshotOf(this.job) : null };
  }

  /** 現在のsnapshotの取得とlistener登録を同期の1手で行う（ADR-0030） */
  subscribe(listener: Listener): SseSubscription<DlsiteJobEvent> {
    const job = this.job;
    const replay: DlsiteJobEvent[] = [{ type: "snapshot", ...this.getState() }];
    if (!job || job.status === "finished") {
      return { replay, live: false, unsubscribe: () => {} };
    }
    job.listeners.add(listener);
    return { replay, live: true, unsubscribe: () => job.listeners.delete(listener) };
  }

  /** 待機中のコードをキューから外す。取得中のコードは止めない */
  cancel(jobId: string): number {
    const job = this.job;
    if (!job || job.status !== "running" || job.jobId !== jobId) return 0;
    const removed: string[] = [];
    for (const [code, entry] of job.codes) {
      if (phaseOf(entry) === "queued") removed.push(code);
    }
    if (removed.length === 0) return 0;
    const removedSet = new Set(removed);
    for (const code of removed) job.codes.delete(code);
    job.queue = job.queue.filter((code) => !removedSet.has(code));
    this.emit(job, {
      type: "removed",
      revision: this.bump(),
      jobId,
      productCodes: removed,
      progress: this.progressOf(job),
    });
    return removed.length;
  }

  /** root再設定・テストリセット用。キューを捨て、実行中の取得を打ち切って終了を待つ */
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

  private admit(job: Job, code: string, force: boolean): void {
    const entry = job.codes.get(code);
    if (!entry) {
      const created: CodeEntry = {
        state: "queued",
        result: null,
        revision: 0,
        force,
        refetch: false,
        attemptForce: false,
      };
      job.codes.set(code, created);
      job.queue.push(code);
      this.emitCode(job, code, created);
      return;
    }
    const phase = phaseOf(entry);
    if (phase === "queued") {
      if (force) entry.force = true;
      return;
    }
    if (phase === "fetching") {
      if (force) {
        entry.force = true;
        if (!entry.attemptForce) entry.refetch = true;
      }
      return;
    }
    entry.force = force;
    entry.state = "queued";
    entry.result = null;
    job.queue.push(code);
    this.emitCode(job, code, entry);
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
      let result: DlsiteTerminalProductSummary = { state: "failed" };
      do {
        entry.refetch = false;
        entry.attemptForce = entry.force;
        try {
          result = await this.adapter.fetchDlsiteProduct(code, {
            force: entry.force,
            signal: job.controller.signal,
          });
        } catch (error) {
          if (job.detached) return;
          dlsiteLogger.error("DLsite取得ジョブのコード処理に失敗しました", {
            productCode: code,
            ...formatError(error),
          });
          result = { state: "failed" };
        }
      } while (entry.refetch && !job.detached);
      if (job.detached) return;
      entry.result = result;
      this.emitCode(job, code, entry);
    }
  }

  private finish(job: Job, reason: "complete" | "aborted"): void {
    job.status = "finished";
    this.emit(job, { type: "finished", revision: this.bump(), jobId: job.jobId, reason });
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
    this.bump();
  }

  /** クライアントに見える変化は revision を進めて送る。見える状態を変えずには進めない */
  private emitCode(job: Job, productCode: string, entry: CodeEntry): void {
    entry.revision = this.bump();
    this.emit(job, {
      type: "code",
      jobId: job.jobId,
      progress: this.progressOf(job),
      ...this.codeOf(productCode, entry),
    });
  }

  private codeOf(productCode: string, entry: CodeEntry): DlsiteJobCode {
    const base = { productCode, revision: entry.revision };
    const { result } = entry;
    if (!result) return { ...base, state: entry.state };
    switch (result.state) {
      case "fetched":
        return { ...base, state: "fetched", dlsite: result };
      case "cover_missing":
        return { ...base, state: "cover_missing", dlsite: result };
      case "not_found":
        return { ...base, state: "not_found", dlsite: result };
      case "failed":
        return { ...base, state: "failed", dlsite: result };
    }
  }

  private emit(job: Job, event: DlsiteJobEvent): void {
    for (const listener of job.listeners) listener(event);
  }

  private progressOf(job: Job): DlsiteJobProgress {
    let processed = 0;
    let total = 0;
    for (const entry of job.codes.values()) {
      total += 1;
      if (entry.result) processed += 1;
    }
    return { processed, total };
  }

  private snapshotOf(job: Job): DlsiteJobSnapshot {
    return {
      jobId: job.jobId,
      status: job.status,
      codes: [...job.codes].map(([productCode, entry]) => this.codeOf(productCode, entry)),
      progress: this.progressOf(job),
    };
  }
}
