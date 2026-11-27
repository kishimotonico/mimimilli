import {
  DEFAULT_DLSITE_CACHE_TTLS_MS,
  applyDlsiteStatePatch,
  planDlsiteApply,
  hasRjCode,
} from "@mimimilli/shared";
import { DlsiteRefetchRequiredError } from "../../errors.ts";
import type {
  DlsiteApplyBody,
  DlsiteApplyResponse,
  DlsiteCachedCover,
  DlsiteFetchResult,
  DlsiteTerminalProductSummary,
  DlsiteStateUpdateBody,
  DlsiteWorkFetchResult,
  DlsiteWorkInfo,
  WorkSourceMutationResult,
} from "@mimimilli/shared";
import type { DlsiteAdapter } from "../../adapter/dlsite.ts";
import {
  applyFixtureCachedCover,
  dlsiteFetchFailureFor,
  fixtureDlsiteCoverCached,
  fixtureDlsiteCoverKey,
  fixtureDlsiteSummary,
  fixtureUsableDlsite,
  dlsiteLinkageOf,
  normalizeDlsiteCacheKey,
  setDlsiteLinkage,
  type FixtureState,
} from "./state.ts";
import { fixtureSourceMutation, requireFixtureRevision } from "./works.ts";

/** このRJコードを持つ作品は dlsiteFetchByCode が常に取得失敗を返す（real/fixture契約テスト用） */
export const FIXTURE_DLSITE_FETCH_FAILURE_RJ_CODE = "RJ000404";

/** このRJコードは取得すると該当なし（not_found）になる */
export const FIXTURE_DLSITE_NOT_FOUND_RJ_CODE = "RJ000403";

/** このRJコードは取得済みになるが、カバーの取得に失敗する（カバーはキャッシュに置かれず、失敗が記録される） */
export const FIXTURE_DLSITE_COVER_UNFETCHABLE_RJ_CODE = "RJ000402";

/** このRJコードはDLsite側にカバー画像が無い（coverUrl が null） */
export const FIXTURE_DLSITE_COVERLESS_RJ_CODE = "RJ000400";

/** このRJコードは取得済みになり、カバーキャッシュには画像として読めないバイト列が置かれる */
export const FIXTURE_DLSITE_UNREADABLE_COVER_RJ_CODE = "RJ000406";

const FIXTURE_COVER_BACKGROUNDS = ["#3b6ea8", "#a8573b", "#4a8f5a", "#8a4fa0", "#b58a2d"];

function fixtureCoverImage(rjCode: string): Uint8Array {
  const background = FIXTURE_COVER_BACKGROUNDS[Number(rjCode.slice(-1)) % 5];
  return new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="${background}"/><text x="150" y="200" font-family="sans-serif" font-size="32" font-weight="700" fill="#fff" text-anchor="middle">${rjCode}</text></svg>`,
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("取得はキャンセルされました", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("取得はキャンセルされました", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function createDlsiteMethods(
  state: FixtureState,
  options: { fetchDelayMs?: number } = {},
): DlsiteAdapter {
  const fetchDelayMs = options.fetchDelayMs ?? 0;

  async function fetchProduct(
    rjCode: string,
    force: boolean,
    signal?: AbortSignal,
  ): Promise<DlsiteFetchResult> {
    const result = await fetchInfo(rjCode, force, signal);
    if (result.ok) prefetchCover(normalizeDlsiteCacheKey(rjCode), result.info, force);
    return result;
  }

  /** realのprefetchCoverと同じ規則。キャッシュ済み・失敗の記録がTTL内（forceなら無視）なら何もせず、取得不可コードは失敗を記録し、それ以外はカバーを置く */
  function prefetchCover(key: string, info: DlsiteWorkInfo, force: boolean): void {
    if (info.coverUrl === null) return;
    const coverKey = fixtureDlsiteCoverKey(info.coverUrl);
    const now = Date.now();
    if (state.dlsiteCovers.has(coverKey)) return;
    if (!force && (state.dlsiteCoverFailures.get(coverKey) ?? 0) > now) return;
    if (key === FIXTURE_DLSITE_COVER_UNFETCHABLE_RJ_CODE) {
      state.dlsiteCoverFailures.set(coverKey, now + DEFAULT_DLSITE_CACHE_TTLS_MS.error);
      return;
    }
    state.dlsiteCoverFailures.delete(coverKey);
    const unreadable = key === FIXTURE_DLSITE_UNREADABLE_COVER_RJ_CODE;
    state.dlsiteCovers.set(coverKey, {
      body: unreadable ? new TextEncoder().encode("not an image") : fixtureCoverImage(key),
      contentType: unreadable ? "application/octet-stream" : "image/svg+xml",
      fetchedAt: now,
    });
  }

  /** realのDlsiteCacheと同じく、失敗の記録→取得済み→通信の順に判断する。forceは失敗の記録を無視して取り直す */
  async function fetchInfo(
    rjCode: string,
    force: boolean,
    signal?: AbortSignal,
  ): Promise<DlsiteFetchResult> {
    const key = normalizeDlsiteCacheKey(rjCode);
    if (!force) {
      const failure = dlsiteFetchFailureFor(state, key);
      if (failure?.kind === "failure") {
        return {
          ok: false,
          kind: failure.outcome,
          message: `fixture: キャッシュ済みの取得失敗（${key}）`,
        };
      }
    }
    const fetched = state.dlsiteFetched.get(key);
    if (fetched && fetched.expiresAt > Date.now()) return { ok: true, info: fetched.info };
    if (fetchDelayMs > 0) await sleep(fetchDelayMs, signal);
    else if (signal?.aborted) throw new DOMException("取得はキャンセルされました", "AbortError");
    const now = Date.now();
    const failureOutcome =
      key === FIXTURE_DLSITE_FETCH_FAILURE_RJ_CODE
        ? "error"
        : key === FIXTURE_DLSITE_NOT_FOUND_RJ_CODE
          ? "not_found"
          : null;
    if (failureOutcome) {
      state.dlsiteFetched.delete(key);
      state.dlsiteFetchFailures.set(key, {
        kind: "failure",
        outcome: failureOutcome,
        attemptedAt: now,
        expiresAt: now + DEFAULT_DLSITE_CACHE_TTLS_MS[failureOutcome],
      });
      return {
        ok: false,
        kind: failureOutcome,
        message: `fixture: 取得に失敗する作品（${key}）`,
      };
    }
    const info: DlsiteWorkInfo = {
      rjCode: key,
      title: `（fixture）${key}`,
      circle: "fixtureサークル",
      cvs: ["fixture CV"],
      genreTags: ["テスト"],
      ageRating: "全年齢",
      coverUrl:
        key === FIXTURE_DLSITE_COVERLESS_RJ_CODE
          ? null
          : `https://img.dlsite.jp/fixture/${key}_img_main.jpg`,
      url: `https://www.dlsite.com/maniax/work/=/product_id/${key}.html`,
    };
    state.dlsiteFetchFailures.delete(key);
    state.dlsiteFetched.set(key, {
      info,
      fetchedAt: now,
      expiresAt: now + DEFAULT_DLSITE_CACHE_TTLS_MS.ok,
    });
    return { ok: true, info };
  }

  async function dlsiteFetchByCode(
    rjCode: string,
    force?: boolean,
    options?: { signal?: AbortSignal },
  ): Promise<DlsiteFetchResult> {
    return fetchProduct(rjCode, force ?? false, options?.signal);
  }

  function lookupDlsiteCachedCover(coverUrl: string | null): DlsiteCachedCover | null {
    if (!coverUrl) return null;
    const key = fixtureDlsiteCoverKey(coverUrl);
    const cover = state.dlsiteCovers.get(key);
    return cover ? { key, version: cover.fetchedAt } : null;
  }

  return {
    async dlsiteFetch(
      workId: string,
      force?: boolean,
      options?: { signal?: AbortSignal },
    ): Promise<DlsiteWorkFetchResult> {
      const work = state.works.find((candidate) => candidate.id === workId);
      if (!work)
        return { ok: false, kind: "not_found", message: `作品が見つかりません: ${workId}` };
      const linkage = dlsiteLinkageOf(state, workId);
      if (!hasRjCode(linkage)) {
        return { ok: false, kind: "not_found", message: "RJコードが検出されていません" };
      }
      const result = await dlsiteFetchByCode(linkage.rjCode, force, options);
      if (!result.ok) return result;
      const usable = fixtureUsableDlsite(state, linkage.rjCode);
      if (!usable) {
        return { ok: false, kind: "error", message: "DLsite情報を読み出せませんでした" };
      }
      return {
        ok: true,
        info: result.info,
        infoRevision: usable.revision,
        cachedCover: lookupDlsiteCachedCover(result.info.coverUrl),
      };
    },

    dlsiteFetchByCode,

    lookupDlsiteCachedCover,

    getCachedDlsiteCover(coverKey: string) {
      const cover = state.dlsiteCovers.get(coverKey);
      return cover
        ? { body: cover.body, contentType: cover.contentType, version: cover.fetchedAt }
        : null;
    },

    isDlsiteOffline: () => false,

    async fetchDlsiteProduct(
      productCode: string,
      fetchOptions: { force: boolean; signal?: AbortSignal },
    ): Promise<DlsiteTerminalProductSummary> {
      await fetchProduct(productCode, fetchOptions.force, fetchOptions.signal);
      const summary = fixtureDlsiteSummary(state, productCode);
      return summary.state === "none" ? { state: "failed" } : summary;
    },

    async dlsiteApply(workId: string, body: DlsiteApplyBody): Promise<DlsiteApplyResponse | null> {
      const work = state.works.find((w) => w.id === workId);
      if (!work) return null;
      requireFixtureRevision(state, workId, body.sourceRevision);
      const linkage = dlsiteLinkageOf(state, workId);
      const usable = hasRjCode(linkage) ? fixtureUsableDlsite(state, linkage.rjCode) : null;
      if (!usable || usable.revision !== body.infoRevision) throw new DlsiteRefetchRequiredError();
      const { info } = usable;
      const plan = planDlsiteApply(
        {
          title: work.title,
          tags: work.tags,
          urls: work.urls,
          hasCover: work.cover !== null,
          dlsite: linkage,
        },
        info,
        body.apply,
        { coverCached: fixtureDlsiteCoverCached(state, info.coverUrl) },
      );
      if (plan.title !== undefined) work.title = plan.title;
      if (plan.tags !== undefined) work.tags = plan.tags;
      if (plan.urls !== undefined) work.urls = plan.urls;
      const coverSkipped = body.apply.cover
        ? applyFixtureCachedCover(state, work, info.coverUrl)
        : null;
      setDlsiteLinkage(state, workId, plan.dlsite);
      return { ...fixtureSourceMutation(state, work), coverSkipped };
    },

    async updateDlsiteState(
      workId: string,
      body: DlsiteStateUpdateBody,
    ): Promise<WorkSourceMutationResult | null> {
      const work = state.works.find((candidate) => candidate.id === workId);
      if (!work) return null;
      requireFixtureRevision(state, workId, body.sourceRevision);
      const { sourceRevision: _sourceRevision, ...patch } = body;
      const nextLinkage = applyDlsiteStatePatch(dlsiteLinkageOf(state, workId), patch);
      setDlsiteLinkage(state, workId, nextLinkage);
      return fixtureSourceMutation(state, work);
    },
  };
}
