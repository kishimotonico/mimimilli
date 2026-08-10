import {
  dedupeTags,
  tagEquals,
  type DataIntegrityWarning,
  type DlsiteBulkMode,
  type DlsiteBulkProgressEvent,
  type DlsiteBulkResult,
  type DlsiteFetchResult,
  type NormalizedTag,
  type Work,
  type WorkSummary,
} from "@mimimilli/shared";
import { isDefaultTitle } from "../../core/dlsiteTitle.ts";
import { DlsiteOfflineError } from "../../errors.ts";
import { mergeDlsiteTags } from "./dlsite.ts";
import { persistDlsiteAppliedWork } from "./dlsitePersist.ts";
import { patchMetaFile } from "./meta.ts";
import { logDataIntegritySkips, toDataIntegrityWarning } from "./dataIntegrity.ts";
import type { Db } from "./db.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import type { CoverColumns } from "./workRowMapping.ts";
import type { createDlsiteFetch, DlsiteFetchAttempt } from "./dlsiteFetch.ts";

export interface DlsiteBulkDeps {
  db: Db;
  query: WorkQueryRepository;
  catalog: CatalogWorkRepository;
  fetch: ReturnType<typeof createDlsiteFetch>;
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

export function shouldSkipCachedFailureWrite(
  work: WorkSummary,
  fetched: Extract<DlsiteFetchResult, { ok: false }>,
  httpAttempted: boolean,
): boolean {
  if (httpAttempted) return false;
  const newStatus = fetched.kind === "not_found" ? ("not_found" as const) : ("error" as const);
  const newErrorKind =
    fetched.kind === "not_found" || fetched.kind === "parse_error" || fetched.kind === "error"
      ? fetched.kind
      : null;
  return (
    work.dlsite.status === newStatus &&
    work.dlsite.error === fetched.message &&
    work.dlsite.errorKind === newErrorKind
  );
}

interface ApplyDlsiteBulkWorkInput {
  mode: DlsiteBulkMode;
  work: WorkSummary;
  attempt: DlsiteFetchAttempt;
  signal?: AbortSignal;
}

interface ApplyDlsiteBulkWorkDeps {
  db: Db;
  catalog: CatalogWorkRepository;
  cachedCover: ReturnType<typeof createDlsiteFetch>["cachedCover"];
  measureDownloadedCover: ReturnType<typeof createDlsiteFetch>["measureDownloadedCover"];
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
  const { db, catalog, cachedCover, measureDownloadedCover, logger } = deps;
  const { mode, work, attempt, signal } = input;
  const fetched = attempt.result;
  const attemptedAt = attempt.httpAttempted ? new Date().toISOString() : work.dlsite.lastAttemptAt;

  if (!fetched.ok) {
    const logContext = {
      workId: work.id,
      rjCode: work.dlsite.rjCode,
      errorKind: fetched.kind,
      message: fetched.message,
      httpAttempted: attempt.httpAttempted,
    };
    if (fetched.kind === "offline") {
      return { fetched: 0, failed: 1, parseErrors: 0 };
    }
    if (fetched.kind === "parse_error") {
      logger.warn("DLsite一括取得: 作品のパースに失敗しました", logContext);
    } else {
      logger.warn("DLsite一括取得: 作品の取得に失敗しました", logContext);
    }
    if (!shouldSkipCachedFailureWrite(work, fetched, attempt.httpAttempted)) {
      const newStatus = fetched.kind === "not_found" ? ("not_found" as const) : ("error" as const);
      const newErrorKind =
        fetched.kind === "not_found" || fetched.kind === "parse_error" || fetched.kind === "error"
          ? fetched.kind
          : null;
      const dlsite = {
        ...work.dlsite,
        status: newStatus,
        lastAttemptAt: attemptedAt,
        error: fetched.message,
        errorKind: newErrorKind,
      };
      db.transaction(() => {
        catalog.setDlsiteState(work.id, dlsite);
        const metaPath = catalog.getWorkMetaPath(work.id);
        if (metaPath) patchMetaFile(metaPath, { dlsite });
      });
    }
    return {
      fetched: 0,
      failed: 1,
      parseErrors: fetched.kind === "parse_error" ? 1 : 0,
    };
  }

  const allInfoTags = mergeDlsiteTags([], fetched.info);
  const applyTags =
    mode === "new"
      ? allInfoTags
      : allInfoTags.filter(
          (tag) => !work.dlsite.appliedTags.some((applied) => tagEquals(applied, tag)),
        );
  const nextTags = dedupeTags([...work.tags, ...applyTags]);
  const nextTitle =
    mode === "new" || isDefaultTitle(work.title, work.physicalPath, work.dlsite.rjCode)
      ? fetched.info.title
      : undefined;
  const nextUrls = !work.urls.some((entry) => entry.url.includes("dlsite.com"))
    ? [...work.urls, { label: "DLsite", url: fetched.info.url }]
    : undefined;
  const coverNeeded = !work.cover && !!fetched.info.coverUrl;
  const nextAppliedTags = dedupeTags([...work.dlsite.appliedTags, ...allInfoTags]);
  const patch: {
    title?: string;
    tags?: NormalizedTag[];
    cover?: CoverColumns;
    urls?: Work["urls"];
  } = { tags: nextTags };
  if (nextTitle !== undefined) patch.title = nextTitle;
  if (nextUrls !== undefined) patch.urls = nextUrls;
  let coverImage: string | undefined;
  if (coverNeeded) {
    coverImage = await cachedCover(fetched.info.coverUrl!, work.physicalPath, signal);
    const cover = await measureDownloadedCover(work.physicalPath, coverImage);
    if (!cover) throw new Error(`カバー寸法を計測できません: ${coverImage}`);
    patch.cover = cover;
  }
  const dlsite = {
    rjCode: fetched.info.rjCode,
    status: "applied" as const,
    lastAttemptAt: attemptedAt,
    error: null,
    errorKind: null,
    appliedTags: nextAppliedTags,
  };
  persistDlsiteAppliedWork(
    db,
    catalog,
    { workId: work.id, catalogPatch: patch, coverImage, dlsite },
    { ifWorkMissing: "throw" },
  );
  return { fetched: 1, failed: 0, parseErrors: 0 };
}

export function createDlsiteBulk(deps: DlsiteBulkDeps) {
  const { db, query, catalog, fetch } = deps;
  const {
    dlsiteLogger,
    dlsiteScheduler,
    fetchCachedDlsiteAttempt,
    cachedCover,
    measureDownloadedCover,
  } = fetch;

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

        const applyDeps: ApplyDlsiteBulkWorkDeps = {
          db,
          catalog,
          cachedCover,
          measureDownloadedCover,
          logger: dlsiteLogger,
        };

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
          const attemptedAt = attempt.httpAttempted
            ? new Date().toISOString()
            : work.dlsite.lastAttemptAt;
          try {
            const outcome = await applyDlsiteBulkWork(applyDeps, {
              mode,
              work,
              attempt,
              signal,
            });
            result.fetched += outcome.fetched;
            result.failed += outcome.failed;
            result.parseErrors += outcome.parseErrors;
            if (
              outcome.failed > 0 &&
              attempt.result.ok === false &&
              attempt.result.kind === "offline"
            ) {
              continue;
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
            dlsiteLogger.error("DLsite一括取得: 作品の適用に失敗しました", {
              workId: work.id,
              rjCode: work.dlsite.rjCode,
              message: error instanceof Error ? error.message : String(error),
            });
            const dlsite = {
              ...work.dlsite,
              status: "error" as const,
              lastAttemptAt: attemptedAt,
              error: error instanceof Error ? error.message : "DLsite情報の適用に失敗しました",
              errorKind: "error" as const,
            };
            try {
              db.transaction(() => {
                catalog.setDlsiteState(work.id, dlsite);
                const metaPath = catalog.getWorkMetaPath(work.id);
                if (metaPath) patchMetaFile(metaPath, { dlsite });
              });
            } catch (persistError) {
              dlsiteLogger.error("DLsite失敗状態の保存に失敗しました", {
                workId: work.id,
                persistError:
                  persistError instanceof Error ? persistError.message : String(persistError),
              });
            }
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
