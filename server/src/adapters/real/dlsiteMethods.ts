import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import { writeFileSync } from "node:fs";
import {
  applyDlsiteStatePatch,
  dedupeTags,
  tagEquals,
  type DlsiteApplyBody,
  type DlsiteBulkMode,
  type DlsiteBulkProgressEvent,
  type DlsiteBulkResult,
  type DlsiteFetchResult,
  type DlsiteStatePatch,
  type NormalizedTag,
  type Work,
} from "@mimimilli/shared";
import { isDefaultTitle } from "../../core/dlsiteTitle.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import { DlsiteOfflineError } from "../../adapter.ts";
import { type Db } from "./db.ts";
import {
  detectRjCode,
  fetchDlsiteCover,
  fetchDlsiteHtml,
  listDlsiteMissingFields,
  mergeDlsiteTags,
  normalizeDlsiteCoverUrl,
  parseDlsiteHtml,
} from "./dlsite.ts";
import {
  DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES,
  DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES,
  DlsiteCache,
  type DlsiteCacheOptions,
} from "./dlsiteCache.ts";
import { type DlsiteRequestConfig } from "./dlsiteConfig.ts";
import {
  DlsiteScheduler,
  type DlsiteHttpLogContext,
  type DlsiteSchedulerDependencies,
} from "./dlsiteScheduler.ts";
import { patchMetaFile } from "./meta.ts";
import { persistDlsiteAppliedWork } from "./dlsitePersist.ts";
import { resolveWithin } from "./paths.ts";
import { SharedFlightPool, throwIfAborted } from "./sharedFlight.ts";
import { logDataIntegritySkips, toDataIntegrityWarning } from "./dataIntegrity.ts";
import { measureCoverDimensions } from "./thumbnailCache.ts";
import type { CoverColumns } from "./workRowMapping.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import { getWorkWithLiveProbe } from "./workRefresh.ts";

const dlsiteLogger = getCategoryLogger("dlsite");

export function createDlsiteMethods(deps: {
  db: Db;
  query: WorkQueryRepository;
  catalog: CatalogWorkRepository;
  dlsiteCache: DlsiteCache;
  dlsiteCacheOptions: DlsiteCacheOptions;
  dlsiteRequestConfig: DlsiteRequestConfig;
  dlsiteScheduler: DlsiteScheduler;
  schedulerDependencies?: DlsiteSchedulerDependencies;
}) {
  const {
    db,
    query,
    catalog,
    dlsiteCache,
    dlsiteCacheOptions,
    dlsiteRequestConfig,
    dlsiteScheduler,
    schedulerDependencies,
  } = deps;
  const dlsiteHtmlTransferBytes =
    dlsiteCacheOptions.maxTransferBytes ?? DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES;
  const dlsiteHtmlExpandedBytes =
    dlsiteCacheOptions.maxExpandedBytes ?? DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES;
  const dlsiteCoverMaximumBytes =
    dlsiteCacheOptions.maxTransferBytes ?? DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES;
  const dlsiteUserAgent = dlsiteRequestConfig.userAgent;
  const logDlsiteEvent = (event: Record<string, unknown>) => {
    schedulerDependencies?.logger?.(event);
  };
  const logDlsiteParseResult = (
    productCode: string,
    parsed: DlsiteFetchResult,
    httpAttempted: boolean,
  ) => {
    if (!parsed.ok) {
      if (parsed.kind === "parse_error" && httpAttempted) {
        logDlsiteEvent({
          event: "dlsite_parse_error",
          productCode,
          httpAttempted,
          message: parsed.message,
        });
      }
      return;
    }
    const missingFields = listDlsiteMissingFields(parsed.info);
    if (missingFields.length > 0) {
      logDlsiteEvent({
        event: "dlsite_parse_fields_missing",
        productCode,
        missingFields,
        httpAttempted,
      });
    }
  };
  const dlsiteHtmlFetcher = (productCode: string, signal?: AbortSignal) =>
    fetchDlsiteHtml(
      productCode,
      (input, init) =>
        dlsiteScheduler.fetch(input, { ...init, signal }, {
          productCode,
          resource: "html",
        } satisfies DlsiteHttpLogContext),
      dlsiteHtmlTransferBytes,
      dlsiteHtmlExpandedBytes,
      dlsiteUserAgent,
    );
  const dlsiteCoverFetcher = (coverUrl: string, signal?: AbortSignal) =>
    fetchDlsiteCover(
      coverUrl,
      (input, init) =>
        dlsiteScheduler.fetch(input, { ...init, signal }, {
          coverUrl,
          resource: "cover",
        } satisfies DlsiteHttpLogContext),
      dlsiteCoverMaximumBytes,
      dlsiteUserAgent,
    );
  const dlsiteFlightPool = new SharedFlightPool<DlsiteFetchAttempt>();
  const dlsiteCoverFlightPool = new SharedFlightPool<{ body: Uint8Array; normalizedUrl: string }>();

  /** キャッシュ越しのDLsite取得結果。httpAttemptedはHTTPへ実際に出たか（cache hitならfalse）。 */
  interface DlsiteFetchAttempt {
    result: DlsiteFetchResult;
    httpAttempted: boolean;
  }

  async function fetchCachedDlsiteAttempt(
    productCode: string,
    force = false,
    signal?: AbortSignal,
  ): Promise<DlsiteFetchAttempt> {
    const key = productCode.trim().toUpperCase();
    throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
    if (!force) {
      const resolution = dlsiteCache.resolve({ productCode: key });
      if (resolution.kind !== "miss") {
        const cacheReason = resolution.kind === "failure" ? "failure_ttl_valid" : "ttl_valid";
        logDlsiteEvent({
          event: "dlsite_cache_hit",
          resource: "html",
          key,
          reason: cacheReason,
          outcome: resolution.outcome,
        });
        if (resolution.kind === "html") {
          const parsed = parseDlsiteHtml(resolution.html, key);
          logDlsiteParseResult(key, parsed, false);
          return { result: parsed, httpAttempted: false };
        }
        return {
          result: {
            ok: false,
            kind: resolution.outcome,
            message: `DLsite取得キャッシュ: ${resolution.outcome}（${key}）`,
          },
          httpAttempted: false,
        };
      }
      logDlsiteEvent({
        event: "dlsite_cache_miss",
        resource: "html",
        key,
        reason: resolution.reason,
      });
    } else {
      logDlsiteEvent({
        event: "dlsite_cache_miss",
        resource: "html",
        key,
        reason: "force_refresh",
      });
    }
    try {
      dlsiteScheduler.assertOnline();
    } catch (error) {
      if (error instanceof DlsiteOfflineError) {
        return {
          result: { ok: false, kind: "offline", message: error.message },
          httpAttempted: false,
        };
      }
      throw error;
    }
    // fresh hitはここまでに返す。networkを始める場合だけforce/normalを問わず合流する。
    return dlsiteFlightPool.run(key, signal, async (flightSignal) => {
      try {
        const response = await dlsiteHtmlFetcher(key, flightSignal);
        if (response.status === 404) {
          dlsiteCache.recordFailure({ productCode: key, outcome: "not_found" });
          return {
            result: {
              ok: false,
              kind: "not_found",
              message: `DLsite作品が見つかりません（${key}）`,
            },
            httpAttempted: true,
          };
        }
        if (response.status < 200 || response.status >= 300) {
          dlsiteCache.recordFailure({ productCode: key, outcome: "error" });
          return {
            result: {
              ok: false,
              kind: "error",
              message: `DLsiteの取得に失敗しました（${key}: HTTP ${response.status}）`,
            },
            httpAttempted: true,
          };
        }
        const parsed = parseDlsiteHtml(response.body, key);
        // HTTPが成功した以上、パースの成否にかかわらずsnapshotを更新し失敗記録は消す。
        dlsiteCache.recordSuccess({
          productCode: key,
          outcome: parsed.ok ? "ok" : "parse_error",
          contentType: response.contentType ?? "",
          html: response.body,
          transferSize: response.transferSize,
        });
        logDlsiteParseResult(key, parsed, true);
        return { result: parsed, httpAttempted: true };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        dlsiteCache.recordFailure({ productCode: key, outcome: "error" });
        return {
          result: {
            ok: false,
            kind: "error",
            message: `DLsiteとの通信に失敗しました（${key}: ${(error as Error).message}）`,
          },
          httpAttempted: true,
        };
      }
    });
  }

  async function fetchCachedDlsite(
    productCode: string,
    force = false,
    signal?: AbortSignal,
  ): Promise<DlsiteFetchResult> {
    return (await fetchCachedDlsiteAttempt(productCode, force, signal)).result;
  }

  async function cachedCover(
    coverUrl: string,
    workDir: string,
    signal?: AbortSignal,
  ): Promise<string> {
    throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
    const normalizedUrl = normalizeDlsiteCoverUrl(coverUrl);
    const key = `cover:${createHash("sha256").update(normalizedUrl).digest("hex")}`;
    const cached = dlsiteCache.getCover(normalizedUrl);
    if (cached) {
      logDlsiteEvent({
        event: "dlsite_cache_hit",
        resource: "cover",
        key: normalizedUrl,
        reason: "cached",
      });
      throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
      const extension = (new URL(normalizedUrl).pathname.split(".").pop() ?? "jpg").toLowerCase();
      const fileName = `dlsite_cover.${extension}`;
      writeFileSync(join(workDir, fileName), cached.body);
      return fileName;
    }
    try {
      dlsiteScheduler.assertOnline();
    } catch (error) {
      if (error instanceof DlsiteOfflineError) throw error;
      throw error;
    }
    try {
      const image = await dlsiteCoverFlightPool.run(key, signal, (flightSignal) => {
        const cachedInFlight = dlsiteCache.getCover(normalizedUrl);
        if (cachedInFlight) {
          logDlsiteEvent({
            event: "dlsite_cache_hit",
            resource: "cover",
            key: normalizedUrl,
            reason: "cached",
          });
          return Promise.resolve({ body: cachedInFlight.body, normalizedUrl });
        }
        logDlsiteEvent({
          event: "dlsite_cache_miss",
          resource: "cover",
          key: normalizedUrl,
          reason: "not_cached",
        });
        return dlsiteCoverFetcher(normalizedUrl, flightSignal).then((fetched) => {
          const finalUrl = normalizeDlsiteCoverUrl(fetched.finalUrl);
          dlsiteCache.putCover(finalUrl, fetched.body, fetched.contentType);
          if (finalUrl !== normalizedUrl) {
            dlsiteCache.putCover(normalizedUrl, fetched.body, fetched.contentType);
          }
          return { body: fetched.body, normalizedUrl: finalUrl };
        });
      });
      throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
      const extension = (
        new URL(image.normalizedUrl).pathname.split(".").pop() ?? "jpg"
      ).toLowerCase();
      const fileName = `dlsite_cover.${extension}`;
      writeFileSync(join(workDir, fileName), image.body);
      return fileName;
    } finally {
      await dlsiteScheduler.drain();
    }
  }

  /**
   * ダウンロード済みカバーの寸法を計測して DB 書き込み用の cover 列を作る。
   * 計測に失敗したら null を返し、呼び出し側は DLsite 適用自体を失敗として扱う。
   */
  async function measureDownloadedCover(
    workDir: string,
    coverImage: string,
  ): Promise<CoverColumns | null> {
    const resolved = resolveWithin(workDir, join(workDir, coverImage));
    if (!resolved) return null;
    const dimensions = await measureCoverDimensions(resolved);
    if (!dimensions) return null;
    return { image: coverImage, dimensions };
  }
  return {
    cachedCover,
    async dlsiteFetch(
      workId: string,
      force = false,
      options?: { signal?: AbortSignal },
    ): Promise<DlsiteFetchResult> {
      const work = await getWorkWithLiveProbe(db, query, catalog, workId);
      if (!work)
        return { ok: false, kind: "not_found", message: `作品が見つかりません: ${workId}` };
      const rjCode = work.dlsite.rjCode ?? detectRjCode([basename(work.physicalPath), work.title]);
      if (!rjCode) {
        return { ok: false, kind: "not_found", message: "RJコードが検出されていません" };
      }
      return fetchCachedDlsite(rjCode, force, options?.signal);
    },

    async dlsiteFetchByCode(
      rjCode: string,
      force = false,
      options?: { signal?: AbortSignal },
    ): Promise<DlsiteFetchResult> {
      return fetchCachedDlsite(rjCode, force, options?.signal);
    },

    async dlsiteApply(
      workId: string,
      body: DlsiteApplyBody,
      options?: { signal?: AbortSignal },
    ): Promise<boolean> {
      const signal = options?.signal;
      throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
      const work = await getWorkWithLiveProbe(db, query, catalog, workId);
      if (!work) return false;

      const patch: {
        title?: string;
        tags?: NormalizedTag[];
        cover?: CoverColumns;
        urls?: Work["urls"];
      } = {};
      if (body.applyTitle && body.info.title) patch.title = body.info.title;
      const { applyTags } = body;
      if (applyTags.length > 0) patch.tags = dedupeTags([...work.tags, ...applyTags]);
      if (body.info.url && !work.urls.some((entry) => entry.url.includes("dlsite.com"))) {
        patch.urls = [...work.urls, { label: "DLsite", url: body.info.url }];
      }
      let coverImage: string | undefined;
      if (body.applyCover && body.info.coverUrl) {
        coverImage = await cachedCover(body.info.coverUrl, work.physicalPath, signal);
        throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
        // カバー計測に失敗したら適用自体を失敗として返す（寸法欠損のまま確定させない）。
        const cover = await measureDownloadedCover(work.physicalPath, coverImage);
        if (!cover) return false;
        throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
        patch.cover = cover;
      }

      throwIfAborted(signal, "DLsite一括取得はキャンセルされました");

      const dlsite = {
        rjCode: body.info.rjCode,
        status: "applied" as const,
        lastAttemptAt: new Date().toISOString(),
        error: null,
        errorKind: null,
        appliedTags: dedupeTags([...work.dlsite.appliedTags, ...applyTags]),
      };
      return persistDlsiteAppliedWork(
        db,
        catalog,
        { workId, catalogPatch: patch, coverImage, dlsite },
        { ifWorkMissing: "return-false" },
      );
    },

    async updateDlsiteState(workId: string, patch: DlsiteStatePatch): Promise<Work | null> {
      const work = await getWorkWithLiveProbe(db, query, catalog, workId);
      if (!work) return null;
      const dlsite = applyDlsiteStatePatch(work.dlsite, patch);
      db.transaction(() => {
        catalog.setDlsiteState(workId, dlsite);
        const metaPath = catalog.getWorkMetaPath(workId);
        if (!metaPath) throw new Error(`作品のメタパスが見つかりません: ${workId}`);
        patchMetaFile(metaPath, { dlsite });
      });
      return getWorkWithLiveProbe(db, query, catalog, workId);
    },

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
        // 対象抽出は listSummaries で完結させる（全件 getWork の N+1 を解消。TASK-57）。
        // 以降の個別処理で完全な Work が必要な場合だけ、その作品の getWork を呼ぶ
        const { summaries, skipped } = query.listSummaries(workIds);
        logDataIntegritySkips(dlsiteLogger, "dlsite-bulk", skipped);
        const dataIntegrityWarning = toDataIntegrityWarning(skipped);
        if (dataIntegrityWarning) result.dataIntegrityWarning = dataIntegrityWarning;
        const requested = summaries;
        // 1. work単位で適用対象を選ぶ。statusは「適用が必要か」だけを表す。
        //    skippedとapplied（適用済み）は常に除外。
        //    HTTP再取得可否（ネットワークへ出るか）はここでは決めず、常にキャッシュTTLへ委ねる。
        const targets = requested.filter((work) => {
          if (!work.dlsite.rjCode || work.dlsite.status === "skipped") return false;
          return work.dlsite.status !== "applied";
        });
        result.skipped = requested.length - targets.length;
        const uniqueRjCodes = [...new Set(targets.map((work) => work.dlsite.rjCode!))];
        dlsiteLogger.info("DLsite一括取得を開始しました", {
          mode,
          targetCount: targets.length,
          uniqueRjCodeCount: uniqueRjCodes.length,
          skipped: result.skipped,
        });
        const attempts = new Map<string, DlsiteFetchAttempt>();
        for (const rjCode of uniqueRjCodes) {
          if (isAborted()) {
            dlsiteLogger.info("DLsite一括取得を中断しました", {
              mode,
              durationMs: Date.now() - bulkStartedAt,
              ...result,
            });
            return result;
          }
          try {
            attempts.set(rjCode, await fetchCachedDlsiteAttempt(rjCode, false, signal));
          } catch (error) {
            if (error instanceof DlsiteOfflineError) throw error;
            if (error instanceof DOMException && error.name === "AbortError") return result;
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
          const attempt = attempts.get(work.dlsite.rjCode!)!;
          const fetched = attempt.result;
          // 実HTTPを試みた時だけlastAttemptAtを進める。cache hitは「HTTPをいつ試みたか」を書き換えない。
          const attemptedAt = attempt.httpAttempted
            ? new Date().toISOString()
            : work.dlsite.lastAttemptAt;
          try {
            if (!fetched.ok) {
              if (fetched.kind === "offline") {
                result.failed += 1;
                options?.onProgress?.({
                  type: "progress",
                  processed: index + 1,
                  total: targets.length,
                  workId: work.id,
                });
                continue;
              }
              const logContext = {
                workId: work.id,
                rjCode: work.dlsite.rjCode,
                errorKind: fetched.kind,
                message: fetched.message,
                httpAttempted: attempt.httpAttempted,
              };
              if (fetched.kind === "parse_error") {
                dlsiteLogger.warn("DLsite一括取得: 作品のパースに失敗しました", logContext);
              } else {
                dlsiteLogger.warn("DLsite一括取得: 作品の取得に失敗しました", logContext);
              }
              const newStatus =
                fetched.kind === "not_found" ? ("not_found" as const) : ("error" as const);
              const newErrorKind =
                fetched.kind === "not_found" ||
                fetched.kind === "parse_error" ||
                fetched.kind === "error"
                  ? fetched.kind
                  : null;
              const noOp =
                !attempt.httpAttempted &&
                work.dlsite.status === newStatus &&
                work.dlsite.error === fetched.message &&
                work.dlsite.errorKind === newErrorKind;
              if (!noOp) {
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
              result.failed += 1;
              if (fetched.kind === "parse_error") result.parseErrors += 1;
            } else {
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
              const noOp =
                !attempt.httpAttempted &&
                !coverNeeded &&
                nextUrls === undefined &&
                (nextTitle === undefined || nextTitle === work.title) &&
                arraysEqual(nextTags, work.tags) &&
                tagsEqual(nextAppliedTags, work.dlsite.appliedTags) &&
                work.dlsite.status === "applied" &&
                work.dlsite.rjCode === fetched.info.rjCode &&
                work.dlsite.error === null &&
                work.dlsite.errorKind === null;
              if (!noOp) {
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
                  // カバー計測失敗はこの作品の適用失敗として扱う（error状態へ落として次作品へ続行）。
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
              }
              result.fetched += 1;
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
              options?.onProgress?.({
                type: "progress",
                processed: index + 1,
                total: targets.length,
                workId: work.id,
              });
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
            // 失敗状態の永続化自体が失敗しても（メタ書き込み不能等）ジョブは中断しない。
            // failed への加算と進捗通知は必ず行い、次の作品へ続行する
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
          options?.onProgress?.({
            type: "progress",
            processed: index + 1,
            total: targets.length,
            workId: work.id,
          });
        }
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

function tagsEqual(a: readonly NormalizedTag[], b: readonly NormalizedTag[]): boolean {
  return a.length === b.length && a.every((value, index) => tagEquals(value, b[index]!));
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
