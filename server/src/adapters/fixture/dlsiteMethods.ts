import {
  DEFAULT_DLSITE_CACHE_TTLS_MS,
  applyDlsiteStatePatch,
  buildDlsiteApplyPatch,
  buildDlsiteMissingApplyPatch,
  computeMissingDiff,
  dlsiteProductFetchOutcomeOfResult,
  hasRjCode,
} from "@mimimilli/shared";
import type {
  DlsiteApplyMissingPreviewItem,
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
      const cached = state.dlsiteFetched.get(key);
      if (cached) return { ok: true, info: cached };
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
      coverUrl: null,
      url: `https://www.dlsite.com/maniax/work/=/product_id/${key}.html`,
    };
    state.dlsiteFetchFailures.delete(key);
    state.dlsiteFetched.set(key, info);
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

    isDlsiteOffline: () => false,

    async fetchDlsiteProduct(
      productCode: string,
      fetchOptions: { force: boolean; signal?: AbortSignal },
    ): Promise<DlsiteProductFetchOutcome> {
      return dlsiteProductFetchOutcomeOfResult(
        await fetchProduct(productCode, fetchOptions.force, fetchOptions.signal),
      );
    },

    async dlsiteApplyMissing(workIds) {
      const candidates = state.works.filter((work) => !workIds || workIds.includes(work.id));
      let applied = 0;
      let pending = 0;
      let skipped = 0;
      let failed = 0;
      for (const work of candidates) {
        const linkage = dlsiteLinkageOf(state, work.id);
        if (!hasRjCode(linkage) || linkage.status === "skipped") {
          skipped += 1;
          continue;
        }
        const fetched = await dlsiteFetchByCode(linkage.rjCode);
        if (!fetched.ok) {
          failed += 1;
          continue;
        }
        const diff = computeMissingDiff(work, fetched.info);
        const patch = buildDlsiteMissingApplyPatch(
          { tags: work.tags, urls: work.urls, dlsite: linkage },
          fetched.info,
          diff,
        );
        if (!patch) {
          skipped += 1;
          continue;
        }
        if (patch.tags !== undefined) work.tags = patch.tags;
        if (patch.urls !== undefined) work.urls = patch.urls;
        setDlsiteLinkage(state, work.id, patch.dlsite);
        applied += 1;
      }
      return { applied, pending, skipped, failed };
    },

    async dlsiteApplyMissingPreview(workIds) {
      const candidates = state.works.filter((work) => !workIds || workIds.includes(work.id));
      const items: DlsiteApplyMissingPreviewItem[] = [];
      for (const work of candidates) {
        const linkage = dlsiteLinkageOf(state, work.id);
        if (!hasRjCode(linkage) || linkage.status === "skipped") continue;
        const fetched = await dlsiteFetchByCode(linkage.rjCode);
        if (!fetched.ok) continue;
        const { newTags, applyCover, applyUrl } = computeMissingDiff(work, fetched.info);
        if (newTags.length === 0 && !applyCover && !applyUrl) continue;
        items.push({ workId: work.id, title: work.title, newTags, applyCover, applyUrl });
      }
      return { items };
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
