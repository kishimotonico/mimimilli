import {
  DEFAULT_DLSITE_CACHE_TTLS_MS,
  applyDlsiteStatePatch,
  buildDlsiteApplyPatch,
  dlsiteProductFetchOutcomeOfResult,
  hasRjCode,
} from "@mimimilli/shared";
import type {
  DlsiteCachedCover,
  DlsiteFetchResult,
  DlsiteProductFetchOutcome,
  DlsiteStateUpdateBody,
  DlsiteWorkInfo,
  WorkSourceMutationResult,
} from "@mimimilli/shared";
import type { DlsiteAdapter } from "../../adapter/dlsite.ts";
import { fixtureCoverFromColumns, type FixtureCoverColumns } from "./data.ts";
import {
  dlsiteFetchFailureFor,
  fixtureDlsiteCoverKey,
  fixtureDlsiteResolutionHead,
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

/** このRJコードは取得済みになるが、カバーはキャッシュに置かれない（カバーの先取り失敗相当） */
export const FIXTURE_DLSITE_NO_COVER_RJ_CODE = "RJ000402";

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

  /** realのDlsiteCacheと同じく、失敗の記録→取得済み→通信の順に判断する。forceは記録を無視する */
  async function fetchProduct(
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
      const fetched = state.dlsiteFetched.get(key);
      if (fetched && fixtureDlsiteResolutionHead(state, key).kind === "html") {
        return { ok: true, info: fetched.info };
      }
    }
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
      coverUrl: `https://img.dlsite.jp/fixture/${key}_img_main.jpg`,
      url: `https://www.dlsite.com/maniax/work/=/product_id/${key}.html`,
    };
    state.dlsiteFetchFailures.delete(key);
    state.dlsiteFetched.set(key, {
      info,
      fetchedAt: now,
      expiresAt: now + DEFAULT_DLSITE_CACHE_TTLS_MS.ok,
    });
    if (key !== FIXTURE_DLSITE_NO_COVER_RJ_CODE) {
      state.dlsiteCovers.set(fixtureDlsiteCoverKey(info.coverUrl!), {
        body: fixtureCoverImage(key),
        contentType: "image/svg+xml",
        fetchedAt: now,
      });
    }
    return { ok: true, info };
  }

  async function dlsiteFetchByCode(
    rjCode: string,
    force?: boolean,
    options?: { signal?: AbortSignal },
  ): Promise<DlsiteFetchResult> {
    return fetchProduct(rjCode, force ?? false, options?.signal);
  }

  return {
    async dlsiteFetch(workId: string, force?: boolean, options?: { signal?: AbortSignal }) {
      const work = state.works.find((candidate) => candidate.id === workId);
      if (!work)
        return { ok: false, kind: "not_found", message: `作品が見つかりません: ${workId}` };
      const linkage = dlsiteLinkageOf(state, workId);
      if (!hasRjCode(linkage)) {
        return { ok: false, kind: "not_found", message: "RJコードが検出されていません" };
      }
      return dlsiteFetchByCode(linkage.rjCode, force, options);
    },

    dlsiteFetchByCode,

    lookupDlsiteCachedCover(coverUrl: string | null): DlsiteCachedCover | null {
      if (!coverUrl) return null;
      const key = fixtureDlsiteCoverKey(coverUrl);
      const cover = state.dlsiteCovers.get(key);
      return cover ? { key, version: cover.fetchedAt } : null;
    },

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
    ): Promise<DlsiteProductFetchOutcome> {
      return dlsiteProductFetchOutcomeOfResult(
        await fetchProduct(productCode, fetchOptions.force, fetchOptions.signal),
      );
    },

    async dlsiteApply(
      workId: string,
      body: import("@mimimilli/shared").DlsiteApplyBody,
      _options?: { signal?: AbortSignal },
    ): Promise<WorkSourceMutationResult | null> {
      const work = state.works.find((w) => w.id === workId);
      if (!work) return null;
      requireFixtureRevision(state, workId, body.sourceRevision);
      const patch = buildDlsiteApplyPatch(
        {
          title: work.title,
          tags: work.tags,
          urls: work.urls,
          dlsite: dlsiteLinkageOf(state, workId),
        },
        body,
      );
      if (patch.title !== undefined) work.title = patch.title;
      if (patch.tags !== undefined) work.tags = patch.tags;
      if (patch.urls !== undefined) work.urls = patch.urls;
      if (body.applyCover && body.info.coverUrl) {
        const dimensions = work.cover?.dimensions ?? { width: 900, height: 900 };
        const columns: FixtureCoverColumns = {
          image: body.info.coverUrl,
          dimensions,
        };
        state.coverColumns.set(workId, columns);
        work.cover = fixtureCoverFromColumns(work, columns);
      }
      setDlsiteLinkage(state, workId, patch.dlsite);
      return fixtureSourceMutation(state, work);
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
