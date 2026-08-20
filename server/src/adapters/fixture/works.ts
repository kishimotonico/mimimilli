import { posix } from "node:path";
import {
  emptyDlsiteState,
  isDlsiteFetchFailed,
  isDlsiteParseFailed,
  isRjCodeMissing,
} from "@mimimilli/shared";
import type {
  DlsiteNotificationKind,
  DlsiteNotificationPage,
  DlsiteNotificationQuery,
  DlsiteNotificationSummary,
  IdentityConflictReassignBody,
  Work,
  WorkCreateBody,
  WorkPatch,
  WorkRegisterPreview,
  WorkspacePath,
  WorksPage,
  WorksQuery,
  WorkSummary,
} from "@mimimilli/shared";
import { InvalidResumeError, WorkRegisterError } from "../../errors.ts";
import type { WorkAdapter } from "../../adapter/work.ts";
import { summarizeDlsiteNotifications } from "../../core/dlsiteNotifications.ts";
import { compareJapaneseSortKeys, compareUtf8Bytes } from "../../core/japaneseSortKey.ts";
import { applyWorksQuery, toWorksPage } from "../../core/worksQuery.ts";
import { isPathWithin } from "../../lib/path.ts";
import { buildFullWorkFromState, buildWorkFileEntryTree } from "./playback.ts";
import { normalizeFsPath } from "./fsResolve.ts";
import { coverColumnsOf, type FixtureState } from "./state.ts";

export function createWorkMethods(state: FixtureState): WorkAdapter {
  async function getWorkRegisterPreview(path: WorkspacePath): Promise<WorkRegisterPreview | null> {
    const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
    const workDir = normalizeFsPath(`${rootAbs}/${path}`);
    if (!isPathWithin(rootAbs, workDir, posix)) return null;
    const folderName = workDir.split("/").filter(Boolean).pop() ?? workDir;
    const descendants = state.works.filter(
      (work) => work.physicalPath.startsWith(`${workDir}/`) && work.physicalPath !== workDir,
    );
    const rjMatch = folderName.match(/RJ\d{6,8}/i);
    return {
      suggestedTitle: folderName,
      tags: [],
      detectedRjCode: rjMatch ? rjMatch[0]!.toUpperCase() : null,
      descendantWorkCount: descendants.length,
      alreadyRegistered: state.works.some((work) => work.physicalPath === workDir),
      orphanedMeta: false,
    };
  }

  return {
    async queryWorks(params: WorksQuery): Promise<WorksPage> {
      return toWorksPage(applyWorksQuery(state.works, params), state.rootFolder ?? "/library");
    },

    getWorkRegisterPreview,

    async getDlsiteNotificationSummary(): Promise<DlsiteNotificationSummary> {
      return summarizeDlsiteNotifications(state.works.map((work) => work.dlsite));
    },

    async queryDlsiteNotifications(
      kind: DlsiteNotificationKind,
      query: Required<DlsiteNotificationQuery>,
    ): Promise<DlsiteNotificationPage> {
      const predicate = (() => {
        switch (kind) {
          case "rj-missing":
            return isRjCodeMissing;
          case "fetch-failed":
            return isDlsiteFetchFailed;
          case "parse-failed":
            return isDlsiteParseFailed;
        }
      })();
      const matches = state.works
        .filter((work) => predicate(work.dlsite))
        .sort((a, b) => compareJapaneseSortKeys(a.title, b.title) || compareUtf8Bytes(a.id, b.id));
      const start = (query.page - 1) * query.limit;
      return {
        items: matches.slice(start, start + query.limit).map((work) => ({
          id: work.id,
          title: work.title,
          status: work.dlsite.status,
          rjCode: kind === "parse-failed" ? work.dlsite.rjCode : null,
        })),
        total: matches.length,
      };
    },

    async getWork(id: string): Promise<Work | null> {
      const work = state.works.find((w) => w.id === id);
      return work ? buildFullWorkFromState(state, work) : null;
    },

    async createWork(body: WorkCreateBody): Promise<Work | null> {
      const preview = await getWorkRegisterPreview(body.path);
      if (!preview) return null;
      if (preview.alreadyRegistered) {
        throw new WorkRegisterError(
          "already_registered",
          "このフォルダーは既に作品として登録されています",
        );
      }
      if (preview.descendantWorkCount > 0 && !body.mergeDescendantWorks) {
        throw new WorkRegisterError(
          "descendants_require_merge",
          `配下に登録済み作品が${preview.descendantWorkCount}件あります`,
          preview.descendantWorkCount,
        );
      }
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const workDir = normalizeFsPath(`${rootAbs}/${body.path}`);
      state.works = state.works.filter(
        (work) => !(work.physicalPath.startsWith(`${workDir}/`) && work.physicalPath !== workDir),
      );
      const now = new Date().toISOString();
      const applyTags = body.dlsite?.applyTags ?? [];
      const work: WorkSummary = {
        id: crypto.randomUUID(),
        title: body.title,
        cover: null,
        status: "ok",
        physicalPath: workDir,
        totalDurationSec: 0,
        trackCount: 0,
        addedAt: now,
        errorMessage: null,
        urls:
          body.dlsite?.info.url && body.dlsite.info.url.length > 0
            ? [{ label: "DLsite", url: body.dlsite.info.url }]
            : [],
        tags: body.tags,
        bookmarked: false,
        lastPlayedAt: null,
        dlsite: body.dlsite
          ? {
              rjCode: body.dlsite.info.rjCode,
              status: "applied",
              lastAttemptAt: now,
              error: null,
              errorKind: null,
              appliedTags: applyTags,
            }
          : preview.detectedRjCode
            ? { ...emptyDlsiteState(), rjCode: preview.detectedRjCode }
            : emptyDlsiteState(),
      };
      state.works.push(work);
      return buildFullWorkFromState(state, work);
    },

    async reassignIdentityConflict(_body: IdentityConflictReassignBody): Promise<Work | null> {
      const diagnostic = state.identityConflicts.find((candidate) =>
        candidate.paths.includes(_body.path),
      );
      if (!diagnostic) return null;
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const workDir = normalizeFsPath(`${rootAbs}/${_body.path}`);
      const work = state.works.find((candidate) => candidate.physicalPath === workDir);
      if (!work || work.id !== diagnostic.workId) return null;
      work.id = crypto.randomUUID();
      work.bookmarked = false;
      work.lastPlayedAt = null;
      state.resumes.delete(diagnostic.workId);
      state.identityConflicts = state.identityConflicts.flatMap((candidate) => {
        if (candidate.workId !== diagnostic.workId) return [candidate];
        const paths = candidate.paths.filter((path) => path !== _body.path);
        return paths.length >= 2 ? [{ ...candidate, paths }] : [];
      });
      return buildFullWorkFromState(state, work);
    },

    async deleteWork(id: string): Promise<boolean> {
      const index = state.works.findIndex((w) => w.id === id);
      if (index === -1) return false;
      state.works.splice(index, 1);
      return true;
    },

    async countMissingWorks(): Promise<number> {
      return state.works.filter((w) => w.status === "missing").length;
    },

    async unregisterMissingWorks(): Promise<{ deletedCount: number; failedCount: number }> {
      const deletedCount = state.works.filter((w) => w.status === "missing").length;
      state.works = state.works.filter((w) => w.status !== "missing");
      return { deletedCount, failedCount: 0 };
    },

    async patchWork(id: string, patch: WorkPatch): Promise<Work | null> {
      const work = state.works.find((w) => w.id === id);
      if (!work) return null;
      if (patch.title !== undefined) work.title = patch.title;
      if (patch.tags !== undefined) work.tags = patch.tags;
      if (patch.bookmarked !== undefined) work.bookmarked = patch.bookmarked;
      return buildFullWorkFromState(state, work);
    },

    async saveResume(id: string, body: import("@mimimilli/shared").ResumeBody): Promise<boolean> {
      const work = state.works.find((w) => w.id === id);
      if (!work) return false;
      const fullWork = buildFullWorkFromState(state, work);
      const playlist = fullWork.playlists.find((candidate) => candidate.id === body.playlistId);
      const track = playlist?.tracks.find((candidate) => candidate.id === body.trackId);
      if (!track) {
        throw new InvalidResumeError("resumeのPlaylistまたはTrackが作品に属していません");
      }
      if (track.durationSec !== null && body.offsetSec > track.durationSec) {
        throw new InvalidResumeError("resumeのoffsetSecがトラック区間外です");
      }
      state.resumes.set(id, body);
      return true;
    },

    async touchLastPlayed(id: string): Promise<boolean> {
      const work = state.works.find((w) => w.id === id);
      if (!work) return false;
      work.lastPlayedAt = new Date().toISOString();
      return true;
    },

    async listWorkFiles(id: string) {
      const work = state.works.find((w) => w.id === id);
      return work ? buildWorkFileEntryTree(work, coverColumnsOf(state, work.id)) : null;
    },

    async listTags(): Promise<string[]> {
      return [...new Set(state.works.flatMap((w) => w.tags))].sort();
    },

    async exportLibrary(): Promise<{ data: string }> {
      return { data: JSON.stringify({ version: 1, works: state.works }, null, 2) };
    },
  };
}
