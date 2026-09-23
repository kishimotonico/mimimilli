import { posix } from "node:path";
import {
  emptyDlsiteState,
  isAudioWorkPath,
  isDlsiteFetchFailed,
  isDlsiteParseFailed,
  isRjCodeMissing,
  tagEquals,
  type NormalizedTag,
} from "@mimimilli/shared";
import type {
  DataIntegrityWarning,
  DlsiteNotificationKind,
  DlsiteNotificationPage,
  DlsiteNotificationQuery,
  DlsiteNotificationSummary,
  IdentityConflictReassignBody,
  Work,
  WorkBookmarkPatch,
  WorkBookmarkResult,
  WorkCreateBody,
  WorkEditSnapshot,
  WorkRegisterPreview,
  WorkSourceMutationResult,
  WorkSourcePatch,
  WorkspacePath,
  WorksPage,
  WorksQuery,
  WorkSummary,
} from "@mimimilli/shared";
import {
  descendantsRegisteredError,
  InvalidResumeError,
  SourceChangedError,
  WorkRegisterError,
} from "../../errors.ts";
import type { WorkAdapter } from "../../adapter/work.ts";
import { summarizeDlsiteNotifications } from "../../core/dlsiteNotifications.ts";
import { compareJapaneseSortKeys, compareUtf8Bytes } from "../../core/japaneseSortKey.ts";
import { applyWorksQuery, toWorksPage } from "../../core/worksQuery.ts";
import { isPathWithin } from "../../lib/path.ts";
import { buildFullWorkFromState } from "./playback.ts";
import { normalizeFsPath } from "./fsResolve.ts";
import { type FixtureState, coverColumnsOf } from "./state.ts";

export function fixtureRevisionOf(state: FixtureState, workId: string): string {
  return state.sourceRevisions.get(workId) ?? "fixture";
}

export function bumpFixtureRevision(state: FixtureState, workId: string): string {
  state.sourceRevisionSeq += 1;
  const token = `fixture-${state.sourceRevisionSeq}`;
  state.sourceRevisions.set(workId, token);
  return token;
}

export function requireFixtureRevision(
  state: FixtureState,
  workId: string,
  expected: string,
): void {
  if (fixtureRevisionOf(state, workId) !== expected) throw new SourceChangedError();
}

export function fixtureEditSnapshot(state: FixtureState, work: WorkSummary): WorkEditSnapshot {
  return {
    sourceRevision: fixtureRevisionOf(state, work.id),
    id: work.id,
    physicalPath: work.physicalPath,
    title: work.title,
    tags: work.tags,
    urls: work.urls,
    coverImage: coverColumnsOf(state, work.id).image,
    dlsite: work.dlsite,
  };
}

export function fixtureSourceMutation(
  state: FixtureState,
  work: WorkSummary,
): WorkSourceMutationResult {
  bumpFixtureRevision(state, work.id);
  return { snapshot: fixtureEditSnapshot(state, work), projection: { status: "published" } };
}

export function createWorkMethods(state: FixtureState): WorkAdapter {
  async function getWorkRegisterPreview(path: WorkspacePath): Promise<WorkRegisterPreview | null> {
    const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
    const target = normalizeFsPath(`${rootAbs}/${path}`);
    if (!isPathWithin(rootAbs, target, posix)) return null;
    const name = target.split("/").filter(Boolean).pop() ?? target;
    const isFile = isAudioWorkPath(target);
    const descendants = isFile
      ? []
      : state.works.filter(
          (work) => work.physicalPath.startsWith(`${target}/`) && work.physicalPath !== target,
        );
    const ancestorRegistered = state.works.some((work) => {
      if (isAudioWorkPath(work.physicalPath)) return false;
      return target === work.physicalPath || target.startsWith(`${work.physicalPath}/`);
    });
    const rjMatch = name.match(/RJ\d{6,8}/i);
    const suggestedTitle = isFile ? name.replace(/\.[^.]+$/, "") : name;
    return {
      suggestedTitle,
      tags: [],
      detectedRjCode: rjMatch ? rjMatch[0]!.toUpperCase() : null,
      descendantWorkCount: descendants.length,
      alreadyRegistered:
        state.works.some((work) => work.physicalPath === target) || (isFile && ancestorRegistered),
      orphanedMeta: false,
    };
  }

  return {
    async queryWorks(params: WorksQuery): Promise<WorksPage> {
      const page = toWorksPage(
        applyWorksQuery(state.works, params),
        state.rootFolder ?? "/library",
      );
      return state.dataIntegrityWarning
        ? { ...page, dataIntegrityWarning: state.dataIntegrityWarning }
        : page;
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

    async prepareWorkPlayback(id: string): Promise<Work | null> {
      const work = state.works.find((w) => w.id === id);
      return work ? buildFullWorkFromState(state, work) : null;
    },

    async createWork(body: WorkCreateBody): Promise<WorkSourceMutationResult | null> {
      const preview = await getWorkRegisterPreview(body.path);
      if (!preview) return null;
      if (preview.alreadyRegistered) {
        throw new WorkRegisterError(
          "already_registered",
          "この場所は既に作品として登録されています",
        );
      }
      if (preview.descendantWorkCount > 0) {
        throw descendantsRegisteredError(preview.descendantWorkCount);
      }
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const workDir = normalizeFsPath(`${rootAbs}/${body.path}`);
      const now = new Date().toISOString();
      const applyTags = body.dlsite?.applyTags ?? [];
      const work: WorkSummary = {
        id: crypto.randomUUID(),
        title: body.title,
        cover: null,
        status: "ok",
        physicalPath: workDir,
        totalDurationSec: 0,
        trackCount: isAudioWorkPath(workDir) ? 1 : 0,
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
      state.sourceRevisions.set(work.id, "fixture");
      return { snapshot: fixtureEditSnapshot(state, work), projection: { status: "published" } };
    },

    async reassignIdentityConflict(
      _body: IdentityConflictReassignBody,
    ): Promise<WorkSourceMutationResult | null> {
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
      return { snapshot: fixtureEditSnapshot(state, work), projection: { status: "published" } };
    },

    async projectWorkSource(path: WorkspacePath): Promise<WorkSourceMutationResult | null> {
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const target = normalizeFsPath(`${rootAbs}/${path}`);
      if (!isPathWithin(rootAbs, target, posix)) return null;
      const work = state.works.find((candidate) => candidate.physicalPath === target);
      if (!work) return null;
      return { snapshot: fixtureEditSnapshot(state, work), projection: { status: "published" } };
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

    async getWorkEditSnapshot(id: string): Promise<WorkEditSnapshot | null> {
      const work = state.works.find((candidate) => candidate.id === id);
      return work ? fixtureEditSnapshot(state, work) : null;
    },

    async patchWorkSource(
      id: string,
      patch: WorkSourcePatch,
    ): Promise<WorkSourceMutationResult | null> {
      const work = state.works.find((candidate) => candidate.id === id);
      if (!work) return null;
      requireFixtureRevision(state, id, patch.sourceRevision);
      if (patch.title !== undefined) work.title = patch.title;
      if (patch.tags !== undefined) work.tags = patch.tags;
      if (patch.urls !== undefined) work.urls = patch.urls;
      return fixtureSourceMutation(state, work);
    },

    async patchWorkBookmark(
      id: string,
      patch: WorkBookmarkPatch,
    ): Promise<WorkBookmarkResult | null> {
      const work = state.works.find((candidate) => candidate.id === id);
      if (!work) return null;
      work.bookmarked = patch.bookmarked;
      return { bookmarked: patch.bookmarked };
    },

    async addWorkTag(id: string, tag: NormalizedTag): Promise<WorkSourceMutationResult | null> {
      const work = state.works.find((candidate) => candidate.id === id);
      if (!work) return null;
      if (work.tags.some((existing) => tagEquals(existing, tag))) {
        return { snapshot: fixtureEditSnapshot(state, work), projection: { status: "published" } };
      }
      work.tags = [...work.tags, tag];
      return fixtureSourceMutation(state, work);
    },

    async removeWorkTag(id: string, tag: NormalizedTag): Promise<WorkSourceMutationResult | null> {
      const work = state.works.find((candidate) => candidate.id === id);
      if (!work) return null;
      const nextTags = work.tags.filter((existing) => !tagEquals(existing, tag));
      if (nextTags.length === work.tags.length) {
        return { snapshot: fixtureEditSnapshot(state, work), projection: { status: "published" } };
      }
      work.tags = nextTags;
      return fixtureSourceMutation(state, work);
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

    async listTags(): Promise<string[]> {
      return [...new Set(state.works.flatMap((w) => w.tags))].sort();
    },

    async exportLibrary(): Promise<{ data: string; dataIntegrityWarning?: DataIntegrityWarning }> {
      return {
        data: JSON.stringify({ version: 1, works: state.works }, null, 2),
        ...(state.dataIntegrityWarning ? { dataIntegrityWarning: state.dataIntegrityWarning } : {}),
      };
    },
  };
}
