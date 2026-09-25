// root再設定のワークフロー（ADR-0029）。状態遷移・ジョブ終了の順序・構築の実行状態を持ち、
// I/Oは RootReconfigurationAdapter に任せる。
import type { RootReconfigurationState, ScanProgressEvent } from "@mimimilli/shared";
import type { DataAdapter } from "./adapter/index.ts";
import type { DlsiteJobManager } from "./dlsiteJobManager.ts";
import { formatError, getCategoryLogger } from "./lib/logger.ts";
import type { ScanJobManager } from "./scanJobManager.ts";

const serverLogger = getCategoryLogger("server");

export const ROOT_RECONFIGURATION_INTERRUPTED_MESSAGE =
  "ルートフォルダーの再設定が中断されました。もう一度実行してください";

export class RootReconfigurationInProgressError extends Error {
  constructor() {
    super("ルートフォルダーの再設定は既に実行中です。完了をお待ちください");
    this.name = "RootReconfigurationInProgressError";
  }
}

interface ActiveRun {
  rootFolder: string;
  progress: ScanProgressEvent | null;
  controller: AbortController;
  completion: Promise<void>;
}

type WorkflowAdapter = Pick<
  DataAdapter,
  | "resolveRootFolder"
  | "getRootReconfigurationRecord"
  | "getRootReconfigurationCompletedAt"
  | "beginRootReconfiguration"
  | "rebuildCatalogForRoot"
  | "failRootReconfiguration"
  | "completeRootReconfiguration"
>;

export class RootReconfigurationWorkflow {
  private readonly adapter: WorkflowAdapter;
  private readonly scanJobs: ScanJobManager;
  private readonly dlsiteJobs: DlsiteJobManager;
  private readonly drainAdmittedRequests: () => Promise<void>;
  private run: ActiveRun | null = null;
  private resolving = false;
  private shuttingDown = false;

  constructor(
    adapter: WorkflowAdapter,
    scanJobs: ScanJobManager,
    dlsiteJobs: DlsiteJobManager,
    drainAdmittedRequests: () => Promise<void>,
  ) {
    this.adapter = adapter;
    this.scanJobs = scanJobs;
    this.dlsiteJobs = dlsiteJobs;
    this.drainAdmittedRequests = drainAdmittedRequests;
  }

  async getState(): Promise<RootReconfigurationState> {
    const run = this.run;
    if (run) return { status: "running", rootFolder: run.rootFolder, progress: run.progress };
    const record = await this.adapter.getRootReconfigurationRecord();
    if (record === null) {
      return {
        status: "idle",
        completedAt: await this.adapter.getRootReconfigurationCompletedAt(),
      };
    }
    return {
      status: "failed",
      rootFolder: record.rootFolder,
      message:
        record.phase === "failed" ? record.message : ROOT_RECONFIGURATION_INTERRUPTED_MESSAGE,
    };
  }

  /** 再設定中または失敗のあいだ true。通常操作APIの拒否に使う。 */
  async isLocked(): Promise<boolean> {
    if (this.run) return true;
    return (await this.adapter.getRootReconfigurationRecord()) !== null;
  }

  /** 開始と再試行。rootを確定して running を永続化したところで返り、構築はバックグラウンドで進む。 */
  async start(requestedRootFolder: string): Promise<RootReconfigurationState> {
    if (this.shuttingDown) throw new Error("サーバーの終了処理中です");
    if (this.run || this.resolving) throw new RootReconfigurationInProgressError();
    this.resolving = true;
    let rootFolder: string;
    try {
      rootFolder = await this.adapter.resolveRootFolder(requestedRootFolder);
    } finally {
      this.resolving = false;
    }
    const run: ActiveRun = {
      rootFolder,
      progress: null,
      controller: new AbortController(),
      completion: Promise.resolve(),
    };
    this.run = run;
    await new Promise<void>((resolve, reject) => {
      run.completion = this.execute(run, { resolve, reject });
    });
    return { status: "running", rootFolder, progress: null };
  }

  /** 実行中の構築を中断して終了を待つ。永続値は running のまま残り、中断として扱われる。 */
  async cancelActiveAndAwait(): Promise<void> {
    const run = this.run;
    if (!run) return;
    run.controller.abort();
    await run.completion;
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    await this.cancelActiveAndAwait();
  }

  private async execute(
    run: ActiveRun,
    begun: { resolve: () => void; reject: (error: unknown) => void },
  ): Promise<void> {
    const { signal } = run.controller;
    try {
      // ロック確立前に受理済みのリクエストが、取消・再構築と並走して書き込むのを防ぐ
      // （ADR-0029「開始・再試行の手順」手順2・3の間。リトライや待機ループは設けない）。
      await this.drainAdmittedRequests();
      await this.scanJobs.cancelActiveAndAwait();
      await this.dlsiteJobs.cancelActiveAndAwait();
      if (signal.aborted) throw new Error("サーバーの終了処理中です");
      await this.adapter.beginRootReconfiguration(run.rootFolder);
    } catch (error) {
      this.finish(run);
      begun.reject(error);
      return;
    }
    begun.resolve();
    serverLogger.info("ルートフォルダーの再設定を開始しました", { rootFolder: run.rootFolder });
    try {
      const result = await this.adapter.rebuildCatalogForRoot(run.rootFolder, {
        signal,
        onProgress: (event) => {
          if (!signal.aborted) run.progress = event;
        },
      });
      if (signal.aborted) {
        this.logInterrupted(run);
        return;
      }
      await this.adapter.completeRootReconfiguration();
      this.scanJobs.recordCompleted(result);
      serverLogger.info("ルートフォルダーの再設定が完了しました", {
        rootFolder: run.rootFolder,
        registered: result.registered,
        insertedWorkIdsCount: result.insertedWorkIds.length,
      });
    } catch (error) {
      if (signal.aborted) {
        this.logInterrupted(run);
        return;
      }
      serverLogger.error("ルートフォルダーの再設定に失敗しました", {
        rootFolder: run.rootFolder,
        ...formatError(error),
      });
      const message =
        error instanceof Error ? error.message : "ルートフォルダーの再設定に失敗しました";
      try {
        await this.adapter.failRootReconfiguration(message);
      } catch (persistError) {
        serverLogger.error("ルートフォルダーの再設定の失敗を記録できませんでした", {
          rootFolder: run.rootFolder,
          ...formatError(persistError),
        });
      }
    } finally {
      this.finish(run);
    }
  }

  private finish(run: ActiveRun): void {
    if (this.run === run) this.run = null;
  }

  private logInterrupted(run: ActiveRun): void {
    serverLogger.info("ルートフォルダーの再設定を中断しました", { rootFolder: run.rootFolder });
  }
}
