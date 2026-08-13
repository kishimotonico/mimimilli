import { applyDlsiteStatePatch, dedupeTags, hasRjCode, normalizeTags } from "@mimimilli/shared";
import type {
  DlsiteBulkResult,
  DlsiteFetchResult,
  DlsiteStatePatch,
  Work,
} from "@mimimilli/shared";
import type { DlsiteAdapter } from "../../adapter/dlsite.ts";
import { fixtureCoverFromColumns, type FixtureCoverColumns } from "./data.ts";
import type { FixtureState } from "./state.ts";
import { buildFullWorkFromState } from "./playback.ts";

export function createDlsiteMethods(state: FixtureState): DlsiteAdapter {
  async function dlsiteFetchByCode(
    rjCode: string,
    _force?: boolean,
    _options?: { signal?: AbortSignal },
  ): Promise<DlsiteFetchResult> {
    return {
      ok: true,
      info: {
        rjCode,
        title: `（fixture）${rjCode}`,
        circle: "fixtureサークル",
        cvs: ["fixture CV"],
        genreTags: ["テスト"],
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
      return dlsiteFetchByCode(work.dlsite.rjCode!);
    },

    dlsiteFetchByCode,

    async dlsiteApplyMissing(workIds) {
      const candidates = state.works.filter((work) => !workIds || workIds.includes(work.id));
      let applied = 0;
      let skipped = 0;
      for (const work of candidates) {
        if (!hasRjCode(work.dlsite) || work.dlsite.status === "skipped") {
          skipped += 1;
          continue;
        }
        const fetched = await dlsiteFetchByCode(work.dlsite.rjCode!);
        if (!fetched.ok) continue;
        const tags = dedupeTags(
          normalizeTags(["サークル/fixtureサークル", "cv/fixture CV", "genre/テスト"]),
        ).filter((tag) => !work.tags.includes(tag));
        if (tags.length === 0) {
          skipped += 1;
          continue;
        }
        work.tags = dedupeTags([...work.tags, ...tags]);
        applied += 1;
      }
      return { applied, skipped, failed: 0 };
    },

    async dlsiteApply(
      workId: string,
      body: import("@mimimilli/shared").DlsiteApplyBody,
      _options?: { signal?: AbortSignal },
    ): Promise<boolean> {
      const work = state.works.find((w) => w.id === workId);
      if (!work) return false;
      if (body.applyTitle) work.title = body.info.title;
      const { applyTags } = body;
      work.tags = dedupeTags([...work.tags, ...applyTags]);
      if (body.applyCover && body.info.coverUrl) {
        const dimensions = work.cover?.dimensions ?? { width: 900, height: 900 };
        const columns: FixtureCoverColumns = {
          image: body.info.coverUrl,
          dimensions,
        };
        state.coverColumns.set(workId, columns);
        work.cover = fixtureCoverFromColumns(columns);
      }
      return true;
    },

    async updateDlsiteState(workId: string, patch: DlsiteStatePatch): Promise<Work | null> {
      const work = state.works.find((candidate) => candidate.id === workId);
      if (!work) return null;
      work.dlsite = applyDlsiteStatePatch(work.dlsite, patch);
      return buildFullWorkFromState(state, work);
    },

    async runDlsiteBulk(_mode, workIds, options) {
      const requested = workIds
        ? state.works.filter((work) => workIds.includes(work.id))
        : state.works;
      const targets = requested.filter(
        (work) =>
          hasRjCode(work.dlsite) &&
          (work.dlsite.status === "none" || work.dlsite.status === "error"),
      );
      const result: DlsiteBulkResult = {
        fetched: 0,
        failed: 0,
        parseErrors: 0,
        skipped: requested.length - targets.length,
      };
      for (let index = 0; index < targets.length; index++) {
        if (options?.signal?.aborted) return result;
        const work = targets[index]!;
        options?.onProgress?.({
          type: "progress",
          processed: index,
          total: targets.length,
          work: { id: work.id, rjCode: work.dlsite.rjCode!, title: work.title },
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
