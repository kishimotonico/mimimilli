import {
  type DataIntegrityWarning,
  type DlsiteBulkMode,
  type DlsiteBulkProgressEvent,
  type DlsiteBulkResult,
  type WorkSummary,
} from "@mimimilli/shared";
import { DlsiteOfflineError } from "../../errors.ts";
import { logDataIntegritySkips, toDataIntegrityWarning } from "./dataIntegrity.ts";
import {
  refreshWorkDlsiteProjection,
  shouldRefreshDlsiteProjectionAfterFetch,
} from "./dlsiteProjection.ts";
import type { Db } from "./db.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import type { Scanner } from "./scanner.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";
import type { createDlsiteFetch, DlsiteFetchAttempt } from "./dlsiteFetch.ts";

export interface DlsiteBulkDeps {
  db: Db;
  query: WorkQueryRepository;
  catalog: CatalogWorkRepository;
  scanner: Scanner;
  fetch: ReturnType<typeof createDlsiteFetch>;
  dlsiteCache: DlsiteCache;
}

export interface DlsiteBulkTargetSelection {
  requested: WorkSummary[];
  targets: WorkSummary[];
  skipped: number;
  dataIntegrityWarning?: DataIntegrityWarning;
}

export function selectDlsiteBulkTargets(
  query: WorkQueryRepository,
  workIds: string[] | undefined,
  logger: { warn: (message: string, context?: Record<string, unknown>) => void },
): DlsiteBulkTargetSelection {
  const { summaries, skipped } = query.listSummaries(workIds);
  logDataIntegritySkips(logger, "dlsite-bulk", skipped);
  const dataIntegrityWarning = toDataIntegrityWarning(skipped);
  const requested = summaries;
  const targets = requested.filter((work) => {
    if (!work.dlsite.rjCode || work.dlsite.status === "skipped") return false;
    return work.dlsite.status !== "applied";
  });
  return {
    requested,
    targets,
    skipped: requested.length - targets.length,
    ...(dataIntegrityWarning ? { dataIntegrityWarning } : {}),
  };
}

export async function fetchDlsiteBulkAttempts(
  uniqueRjCodes: string[],
  fetchCachedDlsiteAttempt: (
    productCode: string,
    force: boolean,
    signal?: AbortSignal,
  ) => Promise<DlsiteFetchAttempt>,
  signal: AbortSignal | undefined,
): Promise<Map<string, DlsiteFetchAttempt>> {
  const attempts = new Map<string, DlsiteFetchAttempt>();
  for (const rjCode of uniqueRjCodes) {
    if (signal?.aborted === true) return attempts;
    try {
      attempts.set(rjCode, await fetchCachedDlsiteAttempt(rjCode, false, signal));
    } catch (error) {
      if (error instanceof DlsiteOfflineError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") return attempts;
      attempts.set(rjCode, {
        result: {
          ok: false,
          kind: "error",
          message: error instanceof Error ? error.message : "DLsite取得に失敗しました",
        },
        httpAttempted: false,
      });
    }
  }
  return attempts;
}

interface ApplyDlsiteBulkWorkInput {
  work: WorkSummary;
  attempt: DlsiteFetchAttempt;
}

interface ApplyDlsiteBulkWorkDeps {
  logger: {
    warn: (message: string, context?: Record<string, unknown>) => void;
  };
}

export interface ApplyDlsiteBulkWorkOutcome {
  fetched: number;
  failed: number;
  parseErrors: number;
}

export async function applyDlsiteBulkWork(
  deps: ApplyDlsiteBulkWorkDeps,
  input: ApplyDlsiteBulkWorkInput,
): Promise<ApplyDlsiteBulkWorkOutcome> {
  const { logger } = deps;
  const { work, attempt } = input;
  const fetched = attempt.result;

  if (!fetched.ok) {
    const logContext = {
      workId: work.id,
      rjCode: work.dlsite.rjCode,
      errorKind: fetched.kind,
      message: fetched.message,
      httpAttempted: attempt.httpAttempted,
    };
    if (fetched.kind === "parse_error") {
      logger.warn("DLsite一括取得: 作品のパースに失敗しました", logContext);
    } else {
      logger.warn("DLsite一括取得: 作品の取得に失敗しました", logContext);
    }
    return {
      fetched: 0,
      failed: 1,
      parseErrors: fetched.kind === "parse_error" ? 1 : 0,
    };
  }
  return { fetched: 1, failed: 0, parseErrors: 0 };
}

export function createDlsiteBulk(deps: DlsiteBulkDeps) {
  const { query, fetch, catalog, dlsiteCache } = deps;
  const { dlsiteLogger, dlsiteScheduler, fetchCachedDlsiteAttempt } = fetch;

  const refreshWorkProjection = (workId: string): void => {
    refreshWorkDlsiteProjection(catalog, workId, dlsiteCache);
  };

  return {
    async runDlsiteBulk(
      mode: DlsiteBulkMode,
      workIds: string[] | undefined,
      options?: {
        signal?: AbortSignal;
        onProgress?: (event: Extract<DlsiteBulkProgressEvent, { type: "progress" }>) => void;
      },
    ): Promise<DlsiteBulkResult> {
      const signal = options?.signal;
      const isAborted = (): boolean => signal?.aborted === true;
      const result: DlsiteBulkResult = { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 };
      const bulkStartedAt = Date.now();
      try {
        const selection = selectDlsiteBulkTargets(query, workIds, dlsiteLogger);
        if (selection.dataIntegrityWarning) {
          result.dataIntegrityWarning = selection.dataIntegrityWarning;
        }
        const { targets } = selection;
        result.skipped = selection.skipped;
        const uniqueRjCodes = [...new Set(targets.map((work) => work.dlsite.rjCode!))];
        dlsiteLogger.info("DLsite一括取得を開始しました", {
          mode,
          targetCount: targets.length,
          uniqueRjCodeCount: uniqueRjCodes.length,
          skipped: result.skipped,
        });
        const attempts = await fetchDlsiteBulkAttempts(
          uniqueRjCodes,
          fetchCachedDlsiteAttempt,
          signal,
        );
        if (isAborted()) {
          dlsiteLogger.info("DLsite一括取得を中断しました", {
            mode,
            durationMs: Date.now() - bulkStartedAt,
            ...result,
          });
          return result;
        }

        const applyDeps: ApplyDlsiteBulkWorkDeps = { logger: dlsiteLogger };

        for (let index = 0; index < targets.length; index++) {
          if (isAborted()) {
            dlsiteLogger.info("DLsite一括取得を中断しました", {
              mode,
              durationMs: Date.now() - bulkStartedAt,
              ...result,
            });
            return result;
          }
          const work = targets[index]!;
          options?.onProgress?.({
            type: "progress",
            processed: index,
            total: targets.length,
            work: { id: work.id, rjCode: work.dlsite.rjCode!, title: work.title },
          });
          if (isAborted()) {
            dlsiteLogger.info("DLsite一括取得を中断しました", {
              mode,
              durationMs: Date.now() - bulkStartedAt,
              ...result,
            });
            return result;
          }
          const attempt = attempts.get(work.dlsite.rjCode!)!;
          try {
            const outcome = await applyDlsiteBulkWork(applyDeps, {
              work,
              attempt,
            });
            result.fetched += outcome.fetched;
            result.failed += outcome.failed;
            result.parseErrors += outcome.parseErrors;
            if (shouldRefreshDlsiteProjectionAfterFetch(attempt.result)) {
              refreshWorkProjection(work.id);
            }
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
              dlsiteLogger.info("DLsite一括取得を中断しました", {
                mode,
                durationMs: Date.now() - bulkStartedAt,
                ...result,
              });
              await dlsiteScheduler.drain();
              return result;
            }
            if (error instanceof DlsiteOfflineError) {
              result.failed += 1;
              continue;
            }
            dlsiteLogger.error("DLsite一括取得の結果処理に失敗しました", {
              workId: work.id,
              rjCode: work.dlsite.rjCode,
              message: error instanceof Error ? error.message : String(error),
            });
            result.failed += 1;
          }
        }
        options?.onProgress?.({
          type: "progress",
          processed: targets.length,
          total: targets.length,
          work: null,
        });
        dlsiteLogger.info("DLsite一括取得を完了しました", {
          mode,
          durationMs: Date.now() - bulkStartedAt,
          ...result,
        });
        await dlsiteScheduler.drain();
        return result;
      } catch (error) {
        if (isAborted() || (error instanceof DOMException && error.name === "AbortError")) {
          dlsiteLogger.info("DLsite一括取得を中断しました", {
            mode,
            durationMs: Date.now() - bulkStartedAt,
            ...result,
          });
          return result;
        }
        throw error;
      }
    },
  };
}
