import {
  applyDlsiteStatePatch,
  buildDlsiteApplyPatch,
  buildDlsiteMissingApplyPatch,
  computeMissingDiff,
  hasRjCode,
} from "@mimimilli/shared";
import type {
  DlsiteApplyMissingPreviewItem,
  DlsiteBulkResult,
  DlsiteFetchResult,
  DlsiteStateUpdateBody,
  WorkSourceMutationResult,
} from "@mimimilli/shared";
import type { DlsiteAdapter } from "../../adapter/dlsite.ts";
import { fixtureCoverFromColumns, type FixtureCoverColumns } from "./data.ts";
import { composeWork, dlsiteLinkageOf, setDlsiteLinkage, type FixtureState } from "./state.ts";
import { fixtureSourceMutation, requireFixtureRevision } from "./works.ts";

/** このRJコードを持つ作品は dlsiteFetchByCode が常に取得失敗を返す（real/fixture契約テスト用） */
export const FIXTURE_DLSITE_FETCH_FAILURE_RJ_CODE = "RJ000404";

export function createDlsiteMethods(state: FixtureState): DlsiteAdapter {
  async function dlsiteFetchByCode(
    rjCode: string,
    _force?: boolean,
    _options?: { signal?: AbortSignal },
  ): Promise<DlsiteFetchResult> {
    if (rjCode === FIXTURE_DLSITE_FETCH_FAILURE_RJ_CODE) {
      return { ok: false, kind: "error", message: `fixture: 取得に失敗する作品（${rjCode}）` };
    }
    return {
      ok: true,
      info: {
        rjCode,
        title: `（fixture）${rjCode}`,
        circle: "fixtureサークル",
        cvs: ["fixture CV"],
        genreTags: ["テスト"],
        ageRating: "全年齢",
        coverUrl: null,
        url: `https://www.dlsite.com/maniax/work/=/product_id/${rjCode}.html`,
      },
    };
  }

  return {
    async dlsiteFetch(workId: string, _force?: boolean, _options?: { signal?: AbortSignal }) {
      const work = state.works.find((candidate) => candidate.id === workId);
      if (!work)
        return { ok: false, kind: "not_found", message: `作品が見つかりません: ${workId}` };
      const linkage = dlsiteLinkageOf(state, workId);
      if (!hasRjCode(linkage)) {
        return { ok: false, kind: "not_found", message: "RJコードが検出されていません" };
      }
      return dlsiteFetchByCode(linkage.rjCode);
    },

    dlsiteFetchByCode,

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

    async runDlsiteBulk(_mode, workIds, options) {
      const requested = workIds
        ? state.works.filter((work) => workIds.includes(work.id))
        : state.works;
      const targets = requested.flatMap((work) => {
        const composed = composeWork(state, work);
        if (!hasRjCode(composed.dlsite)) return [];
        if (composed.dlsite.status !== "none" && composed.dlsite.status !== "error") return [];
        return [{ id: work.id, title: work.title, rjCode: composed.dlsite.rjCode }];
      });
      const result: DlsiteBulkResult = {
        fetched: 0,
        failed: 0,
        parseErrors: 0,
        skipped: requested.length - targets.length,
        ...(state.dataIntegrityWarning ? { dataIntegrityWarning: state.dataIntegrityWarning } : {}),
      };
      for (let index = 0; index < targets.length; index++) {
        if (options?.signal?.aborted) return result;
        const work = targets[index]!;
        options?.onProgress?.({
          type: "progress",
          processed: index,
          total: targets.length,
          work: { id: work.id, rjCode: work.rjCode, title: work.title },
        });
        if (options?.signal?.aborted) return result;
        result.fetched += 1;
      }
      options?.onProgress?.({
        type: "progress",
        processed: targets.length,
        total: targets.length,
        work: null,
      });
      return result;
    },
  };
}
