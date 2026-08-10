import { createHash } from "node:crypto";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import type { DlsiteFetchResult } from "@mimimilli/shared";
import { DlsiteOfflineError } from "../../errors.ts";
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
import { resolveWithin } from "./paths.ts";
import { SharedFlightPool, throwIfAborted } from "./sharedFlight.ts";
import { measureCoverDimensions } from "./thumbnailCache.ts";
import type { CoverColumns } from "./workRowMapping.ts";

const dlsiteLogger = getCategoryLogger("dlsite");

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

  async function fetchCachedDlsiteAttempt(
    productCode: string,
    force = false,
    signal?: AbortSignal,
  ): Promise<DlsiteFetchAttempt> {
    throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
    const cached = resolveCachedDlsiteAttempt(productCode, force);
    if (cached) return cached;
    return fetchDlsiteHtmlNetworkAttempt(productCode, signal);
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
    dlsiteLogger,
    dlsiteScheduler,
    fetchCachedDlsiteAttempt,
    fetchCachedDlsite,
    cachedCover,
    measureDownloadedCover,
  };
}
