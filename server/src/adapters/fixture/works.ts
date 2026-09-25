import { posix } from "node:path";
import {
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
  MetaDlsiteState,
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
} from "@mimimilli/shared";
import { SourceChangedError } from "../../errors.ts";
import type { WorkAdapter } from "../../adapter/work.ts";
import { summarizeDlsiteNotifications } from "../../core/dlsiteNotifications.ts";
import { removeIdentityConflictPath } from "../../core/identityConflicts.ts";
import { compareJapaneseSortKeys, compareUtf8Bytes } from "../../core/japaneseSortKey.ts";
import { validateResumeRequest } from "../../core/resumeValidation.ts";
import { assertRegistrationAllowed } from "../../core/workRegistrationGuard.ts";
import { applyWorksQuery, toWorksPage } from "../../core/worksQuery.ts";
import { isPathWithin } from "../../lib/path.ts";
import { buildFullWorkFromState } from "./playback.ts";
import { normalizeFsPath } from "./fsResolve.ts";
import {
  composeWork,
  composeWorks,
  coverColumnsOf,
  dlsiteLinkageOf,
  reassignWorkId,
  removeWorks,
  setDlsiteLinkage,
  type FixtureState,
} from "./state.ts";
import type { FixtureWorkRecord } from "./data.ts";

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

export function fixtureEditSnapshot(
  state: FixtureState,
  work: FixtureWorkRecord,
): WorkEditSnapshot {
  return {
    sourceRevision: fixtureRevisionOf(state, work.id),
    id: work.id,
    physicalPath: work.physicalPath,
    title: work.title,
    tags: work.tags,
    urls: work.urls,
    coverImage: coverColumnsOf(state, work.id).image,
    dlsite: dlsiteLinkageOf(state, work.id),
  };
}

export function fixtureSourceMutation(
  state: FixtureState,
  work: FixtureWorkRecord,
): WorkSourceMutationResult {
  bumpFixtureRevision(state, work.id);
  return { snapshot: fixtureEditSnapshot(state, work), projection: { status: "published" } };
}

/** 登録解除対象workのroot相対pathをidentity_conflict診断から外す。対象がroot配下になければ何もしない。 */
function removeIdentityConflictForWork(state: FixtureState, workId: string): void {
  const work = state.works.find((candidate) => candidate.id === workId);
  if (!work) return;
  const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
  if (!isPathWithin(rootAbs, work.physicalPath, posix)) return;
  const path = work.physicalPath.slice(rootAbs.length + 1);
  state.identityConflicts = removeIdentityConflictPath(state.identityConflicts, workId, path);
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
        applyWorksQuery(composeWorks(state), params),
        state.rootFolder ?? "/library",
      );
      return state.dataIntegrityWarning
        ? { ...page, dataIntegrityWarning: state.dataIntegrityWarning }
        : page;
    },

    getWorkRegisterPreview,

    async getDlsiteNotificationSummary(): Promise<DlsiteNotificationSummary> {
      return summarizeDlsiteNotifications(composeWorks(state).map((work) => work.dlsite));
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
      const matches = composeWorks(state)
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
      return work ? buildFullWorkFromState(state, composeWork(state, work)) : null;
    },

    async prepareWorkPlayback(id: string): Promise<Work | null> {
      const work = state.works.find((w) => w.id === id);
      return work ? buildFullWorkFromState(state, composeWork(state, work)) : null;
    },

    async createWork(body: WorkCreateBody): Promise<WorkSourceMutationResult | null> {
      const preview = await getWorkRegisterPreview(body.path);
      if (!preview) return null;
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const workDir = normalizeFsPath(`${rootAbs}/${body.path}`);
      assertRegistrationAllowed({
        alreadyRegistered: preview.alreadyRegistered,
        descendantWorkCount: preview.descendantWorkCount,
        kind: isAudioWorkPath(workDir) ? "file" : "folder",
      });
      const now = new Date().toISOString();
      const applyTags = body.dlsite?.applyTags ?? [];
      const work: FixtureWorkRecord = {
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
      };
      state.works.push(work);
      state.sourceRevisions.set(work.id, "fixture");
      const linkage: MetaDlsiteState = body.dlsite
        ? { rjCode: body.dlsite.info.rjCode, status: "applied", appliedTags: applyTags }
        : { rjCode: preview.detectedRjCode, status: "none", appliedTags: [] };
      setDlsiteLinkage(state, work.id, linkage);
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
      const oldId = work.id;
      work.id = crypto.randomUUID();
      work.bookmarked = false;
      work.lastPlayedAt = null;
      reassignWorkId(state, oldId, work.id);
      state.resumes.delete(diagnostic.workId);
      state.identityConflicts = removeIdentityConflictPath(
        state.identityConflicts,
        diagnostic.workId,
        _body.path,
      );
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
      if (!state.works.some((w) => w.id === id)) return false;
      removeIdentityConflictForWork(state, id);
      removeWorks(state, new Set([id]));
      return true;
    },

    async countMissingWorks(): Promise<number> {
      return state.works.filter((w) => w.status === "missing").length;
    },

    async unregisterMissingWorks(): Promise<{ deletedCount: number; failedCount: number }> {
      const missingIds = new Set(
        state.works.filter((w) => w.status === "missing").map((w) => w.id),
      );
      for (const id of missingIds) removeIdentityConflictForWork(state, id);
      removeWorks(state, missingIds);
      return { deletedCount: missingIds.size, failedCount: 0 };
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
      const fullWork = buildFullWorkFromState(state, composeWork(state, work));
      const playlist = fullWork.playlists.find((candidate) => candidate.id === body.playlistId);
      const track = playlist?.tracks.find((candidate) => candidate.id === body.trackId);
      validateResumeRequest(track ? { durationSec: track.durationSec } : null, body.offsetSec);
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
        data: JSON.stringify({ version: 1, works: composeWorks(state) }, null, 2),
        ...(state.dataIntegrityWarning ? { dataIntegrityWarning: state.dataIntegrityWarning } : {}),
      };
    },
  };
}
