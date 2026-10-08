import {
  errorMessage,
  type DataIntegrityWarning,
  type DlsiteBulkMode,
  type DlsiteBulkProgressSnapshot,
  type DlsiteBulkResult,
  type DlsiteState,
  hasRjCode,
  type WorkSummary,
} from "@mimimilli/shared";
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

type DlsiteFetchDeps = ReturnType<typeof createDlsiteFetch>;

export interface DlsiteBulkDeps {
  db: Db;
  query: WorkQueryRepository;
  catalog: CatalogWorkRepository;
  scanner: Scanner;
  fetch: DlsiteFetchDeps;
  dlsiteCache: DlsiteCache;
}

export type DlsiteBulkTarget = WorkSummary & { dlsite: DlsiteState & { rjCode: string } };

export interface DlsiteBulkTargetSelection {
  requested: WorkSummary[];
  targets: DlsiteBulkTarget[];
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
  const targets = requested.filter((work): work is DlsiteBulkTarget => {
    if (!hasRjCode(work.dlsite) || work.dlsite.status === "skipped") return false;
    return work.dlsite.status !== "applied";
  });
  return {
    requested,
    targets,
    skipped: requested.length - targets.length,
    ...(dataIntegrityWarning ? { dataIntegrityWarning } : {}),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function fetchDlsiteBulkAttempt(
  rjCode: string,
  fetchCachedDlsiteAttempt: DlsiteFetchDeps["fetchCachedDlsiteAttempt"],
  signal: AbortSignal | undefined,
): Promise<DlsiteFetchAttempt> {
  try {
    return await fetchCachedDlsiteAttempt(rjCode, false, signal);
  } catch (error) {
    if (isAbortError(error)) throw error;
    return {
      result: {
        ok: false,
        kind: "error",
        message: error instanceof Error ? error.message : "DLsite取得に失敗しました",
      },
      httpAttempted: false,
    };
  }
}

function groupByRjCode(targets: DlsiteBulkTarget[]): DlsiteBulkTarget[][] {
  const groups = new Map<string, DlsiteBulkTarget[]>();
  for (const work of targets) {
    const group = groups.get(work.dlsite.rjCode);
    if (group) group.push(work);
    else groups.set(work.dlsite.rjCode, [work]);
  }
  return [...groups.values()];
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
        onProgress?: (progress: DlsiteBulkProgressSnapshot) => void;
      },
    ): Promise<DlsiteBulkResult> {
      const signal = options?.signal;
      const isAborted = (): boolean => signal?.aborted === true;
      const result: DlsiteBulkResult = { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 };
      const bulkStartedAt = Date.now();
      const applyDeps: ApplyDlsiteBulkWorkDeps = { logger: dlsiteLogger };
      const logEnd = (message: string): void =>
        dlsiteLogger.info(message, { mode, durationMs: Date.now() - bulkStartedAt, ...result });

      try {
        const selection = selectDlsiteBulkTargets(query, workIds, dlsiteLogger);
        if (selection.dataIntegrityWarning) {
          result.dataIntegrityWarning = selection.dataIntegrityWarning;
        }
        const { targets } = selection;
        result.skipped = selection.skipped;
        const groups = groupByRjCode(targets);
        const ordered = groups.flat();
        dlsiteLogger.info("DLsite一括取得を開始しました", {
          mode,
          targetCount: targets.length,
          uniqueRjCodeCount: groups.length,
          skipped: result.skipped,
        });
        const progressAt = (processed: number): DlsiteBulkProgressSnapshot => {
          const next = ordered[processed];
          return {
            processed,
            total: ordered.length,
            work: next ? { id: next.id, rjCode: next.dlsite.rjCode, title: next.title } : null,
          };
        };
        options?.onProgress?.(progressAt(0));

        let processed = 0;
        for (const group of groups) {
          if (isAborted()) {
            logEnd("DLsite一括取得を中断しました");
            return result;
          }
          const rjCode = group[0]!.dlsite.rjCode;
          const attempt = await fetchDlsiteBulkAttempt(rjCode, fetchCachedDlsiteAttempt, signal);
          for (const work of group) {
            if (isAborted()) {
              logEnd("DLsite一括取得を中断しました");
              return result;
            }
            try {
              const outcome = await applyDlsiteBulkWork(applyDeps, { work, attempt });
              result.fetched += outcome.fetched;
              result.failed += outcome.failed;
              result.parseErrors += outcome.parseErrors;
              if (shouldRefreshDlsiteProjectionAfterFetch(attempt.result)) {
                refreshWorkProjection(work.id);
              }
            } catch (error) {
              dlsiteLogger.error("DLsite一括取得の結果処理に失敗しました", {
                workId: work.id,
                rjCode,
                message: errorMessage(error),
              });
              result.failed += 1;
            }
            processed += 1;
            options?.onProgress?.(progressAt(processed));
          }
        }
        logEnd("DLsite一括取得を完了しました");
        return result;
      } catch (error) {
        if (isAborted() || isAbortError(error)) {
          logEnd("DLsite一括取得を中断しました");
          return result;
        }
        throw error;
      } finally {
        await dlsiteScheduler.drain();
      }
    },
  };
}
