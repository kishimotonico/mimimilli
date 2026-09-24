import {
  applyDlsiteStatePatch,
  computeMissingDiff,
  hasRjCode,
  mergeAppliedDlsiteTags,
  toDlsiteLinkageStatus,
} from "@mimimilli/shared";
import type {
  DlsiteApplyMissingPreviewItem,
  DlsiteBulkResult,
  DlsiteFetchResult,
  DlsiteState,
  DlsiteStateUpdateBody,
  MetaDlsiteState,
  WorkSourceMutationResult,
  WorkSummary,
} from "@mimimilli/shared";
import type { DlsiteAdapter } from "../../adapter/dlsite.ts";
import { fixtureCoverFromColumns, type FixtureCoverColumns } from "./data.ts";
import type { FixtureState } from "./state.ts";
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
      if (!hasRjCode(work.dlsite)) {
        return { ok: false, kind: "not_found", message: "RJコードが検出されていません" };
      }
      return dlsiteFetchByCode(work.dlsite.rjCode);
    },

    dlsiteFetchByCode,

    async dlsiteApplyMissing(workIds) {
      const candidates = state.works.filter((work) => !workIds || workIds.includes(work.id));
      let applied = 0;
      let pending = 0;
      let skipped = 0;
      let failed = 0;
      for (const work of candidates) {
        if (!hasRjCode(work.dlsite) || work.dlsite.status === "skipped") {
          skipped += 1;
          continue;
        }
        const fetched = await dlsiteFetchByCode(work.dlsite.rjCode);
        if (!fetched.ok) {
          failed += 1;
          continue;
        }
        const { newTags, applyCover, applyUrl } = computeMissingDiff(work, fetched.info);
        if (newTags.length === 0 && !applyCover && !applyUrl) {
          skipped += 1;
          continue;
        }
        work.tags = mergeAppliedDlsiteTags(work.tags, newTags);
        if (applyUrl) {
          work.urls = [...work.urls, { label: "DLsite", url: fetched.info.url }];
        }
        applied += 1;
      }
      return { applied, pending, skipped, failed };
    },

    async dlsiteApplyMissingPreview(workIds) {
      const candidates = state.works.filter((work) => !workIds || workIds.includes(work.id));
      const items: DlsiteApplyMissingPreviewItem[] = [];
      for (const work of candidates) {
        if (!hasRjCode(work.dlsite) || work.dlsite.status === "skipped") continue;
        const fetched = await dlsiteFetchByCode(work.dlsite.rjCode);
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
      if (body.applyTitle) work.title = body.info.title;
      const { applyTags } = body;
      work.tags = mergeAppliedDlsiteTags(work.tags, applyTags);
      if (body.applyUrl && body.info.url) {
        work.urls = [
          ...work.urls.filter((entry) => !entry.url.includes("dlsite.com")),
          { label: "DLsite", url: body.info.url },
        ];
      }
      if (body.applyCover && body.info.coverUrl) {
        const dimensions = work.cover?.dimensions ?? { width: 900, height: 900 };
        const columns: FixtureCoverColumns = {
          image: body.info.coverUrl,
          dimensions,
        };
        state.coverColumns.set(workId, columns);
        work.cover = fixtureCoverFromColumns(work, columns);
      }
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
      const currentLinkage: MetaDlsiteState = {
        rjCode: work.dlsite.rjCode,
        status: toDlsiteLinkageStatus(work.dlsite.status),
        appliedTags: work.dlsite.appliedTags,
      };
      const nextLinkage = applyDlsiteStatePatch(currentLinkage, patch);
      work.dlsite = { ...nextLinkage, lastAttemptAt: null, error: null, errorKind: null };
      return fixtureSourceMutation(state, work);
    },

    async runDlsiteBulk(_mode, workIds, options) {
      const requested = workIds
        ? state.works.filter((work) => workIds.includes(work.id))
        : state.works;
      const targets = requested.filter(
        (work): work is WorkSummary & { dlsite: DlsiteState & { rjCode: string } } =>
          hasRjCode(work.dlsite) &&
          (work.dlsite.status === "none" || work.dlsite.status === "error"),
      );
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
          work: { id: work.id, rjCode: work.dlsite.rjCode, title: work.title },
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
