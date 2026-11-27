import { errorMessage } from "@mimimilli/shared";
import type { DlsiteFetchResult } from "@mimimilli/shared";
import { DlsiteOfflineError } from "../../errors.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import {
  fetchDlsiteCover,
  fetchDlsiteHtml,
  listDlsiteMissingFields,
  normalizeDlsiteCoverUrl,
  type DlsiteParser,
} from "./dlsite.ts";
import {
  DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES,
  DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES,
  DlsiteCache,
  type DlsiteCacheOptions,
} from "./dlsiteCache.ts";
import { type DlsiteRequestConfig } from "./dlsiteConfig.ts";
import {
  createDlsiteProductResolver,
  dlsiteFetchResultOfProductResolution,
  dlsiteFetchStateOfProductResolution,
} from "./dlsiteProductResolve.ts";
import {
  DlsiteScheduler,
  type DlsiteHttpLogContext,
  type DlsiteSchedulerDependencies,
} from "./dlsiteScheduler.ts";
import { SharedFlightPool, throwIfAborted } from "./sharedFlight.ts";

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
  parser: DlsiteParser;
}

export function createDlsiteFetch(deps: DlsiteFetchDeps) {
  const {
    dlsiteCache,
    dlsiteCacheOptions,
    dlsiteRequestConfig,
    dlsiteScheduler,
    schedulerDependencies,
    parser,
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
  const resolveDlsiteProduct = createDlsiteProductResolver(dlsiteCache, parser);
  const dlsiteFlightPool = new SharedFlightPool<DlsiteFetchAttempt>();
  const dlsiteCoverFlightPool = new SharedFlightPool<{ body: Uint8Array; normalizedUrl: string }>();
  const activeFlights = new Set<Promise<unknown>>();
  const shutdown = new AbortController();

  /** 購読者が全員中止して返った後も続くflightを、閉じる側が中止できるよう控える */
  function runTracked<T>(
    pool: SharedFlightPool<T>,
    key: string,
    signal: AbortSignal | undefined,
    execute: (flightSignal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    return pool.run(key, signal, (flightSignal) => {
      const flight = execute(AbortSignal.any([flightSignal, shutdown.signal]));
      activeFlights.add(flight);
      const forget = () => void activeFlights.delete(flight);
      flight.then(forget, forget);
      return flight;
    });
  }

  /**
   * 進行中のflightを中止し、巻き戻りを待つ。中止後のflightはキャッシュへ書かない。
   * 中止に応えない通信を待つ上限は、終了処理の全体タイムアウトが持つ。
   */
  async function abortInFlight(): Promise<void> {
    shutdown.abort();
    await Promise.allSettled(activeFlights);
  }

  function resolveCachedDlsiteAttempt(
    productCode: string,
    force: boolean,
  ): DlsiteFetchAttempt | null {
    const key = productCode.trim().toUpperCase();
    const resolution = resolveDlsiteProduct(key);
    if (
      force &&
      (resolution.kind === "failure" ||
        (resolution.kind === "html" &&
          dlsiteFetchStateOfProductResolution(resolution) === "failed"))
    ) {
      logDlsiteEvent({
        event: "dlsite_cache_miss",
        resource: "html",
        key,
        reason: "force_refresh",
      });
      return null;
    }
    if (resolution.kind === "miss") {
      logDlsiteEvent({
        event: "dlsite_cache_miss",
        resource: "html",
        key,
        reason: resolution.reason,
      });
      return null;
    }
    logDlsiteEvent({
      event: "dlsite_cache_hit",
      resource: "html",
      key,
      reason: resolution.kind === "failure" ? "failure_ttl_valid" : "ttl_valid",
      outcome: resolution.outcome,
    });
    const result = dlsiteFetchResultOfProductResolution(resolution, key);
    return result ? { result, httpAttempted: false } : null;
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
    return runTracked(dlsiteFlightPool, flightKey, signal, async (flightSignal) => {
      try {
        const response = await dlsiteHtmlFetcher(key, flightSignal);
        throwIfAborted(flightSignal);
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
        const parsed = parser.parse(response.body, key);
        dlsiteCache.recordSuccess({
          productCode: key,
          outcome: parsed.ok ? "ok" : "parse_error",
          contentType: response.contentType ?? "",
          html: response.body,
          transferSize: response.transferSize,
          parsed: parsed.ok ? { parserVersion: parser.version, info: parsed.info } : undefined,
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
    throwIfAborted(signal, "DLsite取得は中止されました");
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
    throwIfAborted(signal, "DLsite取得は中止されました");
    const normalizedUrl = normalizeDlsiteCoverUrl(coverUrl);
    const key = `cover:${DlsiteCache.coverKey(normalizedUrl)}`;
    const cached = dlsiteCache.getCover(normalizedUrl);
    if (cached) {
      logDlsiteEvent({
        event: "dlsite_cache_hit",
        resource: "cover",
        key: normalizedUrl,
        reason: "cached",
      });
      throwIfAborted(signal, "DLsite取得は中止されました");
      return { body: cached.body, normalizedUrl };
    }
    dlsiteScheduler.assertOnline();
    const image = await runTracked(dlsiteCoverFlightPool, key, signal, (flightSignal) => {
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
        throwIfAborted(flightSignal);
        const finalUrl = normalizeDlsiteCoverUrl(fetched.finalUrl);
        dlsiteCache.putCover(finalUrl, fetched.body, fetched.contentType);
        if (finalUrl !== normalizedUrl) {
          dlsiteCache.putCover(normalizedUrl, fetched.body, fetched.contentType);
        }
        return { body: fetched.body, normalizedUrl: finalUrl };
      });
    });
    throwIfAborted(signal, "DLsite取得は中止されました");
    return image;
  }

  /**
   * 取得時にカバーをキャッシュへ先取りする。失敗は握り潰してログに出し、TTL付きで記録する。HTMLの取得結果には影響させない。
   * 失敗の記録がTTL内のときは、force でなければ取りに行かない。許可外のホストのURLは記録できず、取りに行かない。
   * 中止（AbortError）は失敗として記録せず、呼び出し元のsignalがabort済みのときだけ再送出する。deadlineMsを過ぎたらカバーなしで戻る。
   */
  async function prefetchCover(
    coverUrl: string | null,
    options: { signal?: AbortSignal; deadlineMs?: number; force?: boolean } = {},
  ): Promise<void> {
    if (!coverUrl) return;
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeDlsiteCoverUrl(coverUrl);
    } catch (error) {
      dlsiteLogger.warn("DLsiteカバーのURLが許可されていません", {
        coverUrl,
        message: errorMessage(error),
      });
      return;
    }
    if (!options.force && dlsiteCache.hasCoverFailure(normalizedUrl)) return;
    const timeout =
      options.deadlineMs === undefined
        ? undefined
        : AbortSignal.timeout(Math.max(0, options.deadlineMs - Date.now()));
    const signals = [options.signal, timeout].filter(
      (signal): signal is AbortSignal => signal !== undefined,
    );
    const signal = signals.length > 0 ? AbortSignal.any(signals) : undefined;
    try {
      await fetchCoverImage(coverUrl, signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (options.signal?.aborted) throw error;
        return;
      }
      dlsiteCache.recordCoverFailure(normalizedUrl);
      dlsiteLogger.warn("DLsiteカバーの先取りに失敗しました", {
        coverUrl,
        message: errorMessage(error),
      });
    }
  }

  return {
    dlsiteLogger,
    dlsiteScheduler,
    fetchCachedDlsiteAttempt,
    fetchCachedDlsite,
    prefetchCover,
    abortInFlight,
  };
}
