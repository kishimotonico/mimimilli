import { createHash } from "node:crypto";
import { join } from "node:path";
import { errorMessage } from "@mimimilli/shared";
import type { DlsiteFetchResult } from "@mimimilli/shared";
import { CoverSaveError, DlsiteOfflineError } from "../../errors.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import {
  fetchDlsiteCover,
  fetchDlsiteHtml,
  listDlsiteMissingFields,
  normalizeDlsiteCoverUrl,
  parseDlsiteHtml,
} from "./dlsite.ts";
import {
  DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES,
  DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES,
  type DlsiteCache,
  type DlsiteCacheOptions,
} from "./dlsiteCache.ts";
import { type DlsiteRequestConfig } from "./dlsiteConfig.ts";
import {
  DlsiteScheduler,
  type DlsiteHttpLogContext,
  type DlsiteSchedulerDependencies,
} from "./dlsiteScheduler.ts";
import { commitTempFile, removeTempFile, writeTempFile } from "./atomicFile.ts";
import { resolveWithin } from "./paths.ts";
import { SharedFlightPool, throwIfAborted } from "./sharedFlight.ts";
import { measureCoverDimensions } from "./thumbnailCache.ts";
import type { CoverColumns } from "./workRowMapping.ts";

const dlsiteLogger = getCategoryLogger("dlsite");

const DLSITE_COVER_BASENAME = "dlsite_cover";
const DLSITE_COVER_EXTENSIONS: ReadonlySet<string> = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function coverExtensionOfUrl(url: string): string | null {
  const lastSegment = new URL(url).pathname.split("/").pop() ?? "";
  const dot = lastSegment.lastIndexOf(".");
  if (dot < 0) return null;
  const extension = lastSegment.slice(dot + 1).toLowerCase();
  return DLSITE_COVER_EXTENSIONS.has(extension) ? extension : null;
}

export interface StagedCover {
  fileName: string;
  dimensions: NonNullable<CoverColumns["dimensions"]>;
  commit(): void;
  discard(): void;
}

export interface DlsiteFetchAttempt {
  result: DlsiteFetchResult;
  httpAttempted: boolean;
}

export interface DlsiteFetchDeps {
  dlsiteCache: DlsiteCache;
  dlsiteCacheOptions: DlsiteCacheOptions;
  dlsiteRequestConfig: DlsiteRequestConfig;
  dlsiteScheduler: DlsiteScheduler;
  schedulerDependencies?: DlsiteSchedulerDependencies;
}

export function createDlsiteFetch(deps: DlsiteFetchDeps) {
  const {
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

  function resolveCachedDlsiteAttempt(
    productCode: string,
    force: boolean,
  ): DlsiteFetchAttempt | null {
    const key = productCode.trim().toUpperCase();
    if (force) {
      logDlsiteEvent({
        event: "dlsite_cache_miss",
        resource: "html",
        key,
        reason: "force_refresh",
      });
      return null;
    }
    const resolution = dlsiteCache.resolve({ productCode: key });
    if (resolution.kind === "miss") {
      logDlsiteEvent({
        event: "dlsite_cache_miss",
        resource: "html",
        key,
        reason: resolution.reason,
      });
      return null;
    }
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

  async function fetchDlsiteHtmlNetworkAttempt(
    productCode: string,
    force: boolean,
    signal?: AbortSignal,
  ): Promise<DlsiteFetchAttempt> {
    const key = productCode.trim().toUpperCase();
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
    const flightKey = force ? `${key}:force` : key;
    return dlsiteFlightPool.run(flightKey, signal, async (flightSignal) => {
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
            message: `DLsiteとの通信に失敗しました（${key}: ${errorMessage(error)}）`,
          },
          httpAttempted: true,
        };
      }
    });
  }

  async function fetchCachedDlsiteAttempt(
    productCode: string,
    force = false,
    signal?: AbortSignal,
  ): Promise<DlsiteFetchAttempt> {
    throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
    const cached = resolveCachedDlsiteAttempt(productCode, force);
    if (cached) return cached;
    return fetchDlsiteHtmlNetworkAttempt(productCode, force, signal);
  }

  async function fetchCachedDlsite(
    productCode: string,
    force = false,
    signal?: AbortSignal,
  ): Promise<DlsiteFetchResult> {
    return (await fetchCachedDlsiteAttempt(productCode, force, signal)).result;
  }

  async function fetchCoverImage(
    coverUrl: string,
    signal?: AbortSignal,
  ): Promise<{ body: Uint8Array; normalizedUrl: string }> {
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
      return { body: cached.body, normalizedUrl };
    }
    dlsiteScheduler.assertOnline();
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
      return image;
    } finally {
      await dlsiteScheduler.drain();
    }
  }

  /**
   * カバーを取得して作品フォルダー内の一時ファイルへ置く。最終名への確定は呼び出し側が
   * commit() で行う。許可外の拡張子・ルート外の作品フォルダー・画像として読めない場合は null。
   */
  async function stageCover(
    coverUrl: string,
    workDir: string,
    root: string,
    signal?: AbortSignal,
  ): Promise<StagedCover | null> {
    const image = await fetchCoverImage(coverUrl, signal);
    const extension = coverExtensionOfUrl(image.normalizedUrl);
    if (!extension) return null;
    const realWorkDir = resolveWithin(root, workDir);
    if (!realWorkDir) return null;
    const fileName = `${DLSITE_COVER_BASENAME}.${extension}`;
    let tmpPath: string;
    try {
      tmpPath = writeTempFile(realWorkDir, DLSITE_COVER_BASENAME, image.body);
    } catch (error) {
      throw new CoverSaveError({ cause: error });
    }
    let dimensions: CoverColumns["dimensions"] | null = null;
    try {
      dimensions = await measureCoverDimensions(tmpPath);
    } finally {
      if (!dimensions) removeTempFile(tmpPath);
    }
    if (!dimensions) return null;
    return {
      fileName,
      dimensions,
      commit: () => {
        try {
          commitTempFile(tmpPath, join(realWorkDir, fileName));
        } catch (error) {
          throw new CoverSaveError({ cause: error });
        }
      },
      discard: () => removeTempFile(tmpPath),
    };
  }

  return {
    dlsiteLogger,
    dlsiteScheduler,
    fetchCachedDlsiteAttempt,
    fetchCachedDlsite,
    stageCover,
  };
}
