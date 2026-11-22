import { posix } from "node:path";
import {
  META_FILE_NAME,
  isAudioFileName,
  META_SIDECAR_SUFFIX,
  planDlsiteRegistration,
  sidecarMetaFileName,
  tagEquals,
  unresolvedWorkPhysicalPath,
  workPlacementOf,
  type NormalizedTag,
} from "@mimimilli/shared";
import type {
  DataIntegrityWarning,
  IdentityConflictReassignBody,
  Work,
  WorkBookmarkPatch,
  WorkBookmarkResult,
  WorkCreateBody,
  WorkEditSnapshot,
  WorkRegisterPreview,
  WorkCreateResponse,
  WorkSourceMutationResult,
  WorkSourcePatch,
  WorkspacePath,
  UnregisterMissingWorksResult,
} from "@mimimilli/shared";
import { SourceChangedError } from "../../errors.ts";
import type { WorkAdapter } from "../../adapter/work.ts";
import { removeIdentityConflictPath } from "../../core/identityConflicts.ts";
import { fileRegisterNaming, folderRegisterNaming } from "../../core/workRegisterPreview.ts";
import { validateResumeRequest } from "../../core/resumeValidation.ts";
import { assertRegistrationAllowed } from "../../core/workRegistrationGuard.ts";
import {
  countWorksByConditions,
  groupWorksByCondition,
  queryWorksByCondition,
} from "../../core/conditionQuery.ts";
import { toWorksPage } from "../../core/worksQuery.ts";
import { isPathWithin } from "../../lib/path.ts";
import { buildFullWorkFromState, checkWorkPlacement } from "./playback.ts";
import { normalizeFsPath } from "./fsResolve.ts";
import { metaPathOfTarget } from "./identityConflictPaths.ts";
import {
  composeWorks,
  applyFixtureCachedCover,
  copyWorkState,
  coverColumnsOf,
  dlsiteLinkageOf,
  fixtureUsableDlsite,
  removeWorks,
  setDlsiteLinkage,
  type FixtureState,
  requireFixtureRoot,
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
  const rootAbs = normalizeFsPath(requireFixtureRoot(state));
  const workPath = unresolvedWorkPhysicalPath(workPlacementOf(work.metaPath));
  if (!isPathWithin(rootAbs, workPath, posix)) return;
  const path = workPath.slice(rootAbs.length + 1);
  state.identityConflicts = removeIdentityConflictPath(state.identityConflicts, workId, path);
}

/** fixtureには実体のファイルシステムが無いため、登録の境界ではパス名で形式を決める */
function registrationMetaPath(target: string): string {
  const name = posix.basename(target);
  return isAudioFileName(name)
    ? posix.join(posix.dirname(target), sidecarMetaFileName(name))
    : posix.join(target, META_FILE_NAME);
}

export function createWorkMethods(state: FixtureState): WorkAdapter {
  async function getWorkRegisterPreview(path: WorkspacePath): Promise<WorkRegisterPreview | null> {
    const rootAbs = normalizeFsPath(requireFixtureRoot(state));
    const target = normalizeFsPath(`${rootAbs}/${path}`);
    if (!isPathWithin(rootAbs, target, posix)) return null;
    const name = target.split("/").filter(Boolean).pop() ?? target;
    const isFile = workPlacementOf(registrationMetaPath(target)).kind === "audio-file";
    const descendants = isFile
      ? []
      : state.works.filter(
          (work) => work.physicalPath.startsWith(`${target}/`) && work.physicalPath !== target,
        );
    const ancestorRegistered = state.works.some((work) => {
      if (workPlacementOf(work.metaPath).kind === "audio-file") return false;
      return target === work.physicalPath || target.startsWith(`${work.physicalPath}/`);
    });
    const naming = isFile ? fileRegisterNaming(name) : folderRegisterNaming(name);
    return {
      ...naming,
      tags: [],
      descendantWorkCount: descendants.length,
      alreadyRegistered:
        state.works.some((work) => work.physicalPath === target) || (isFile && ancestorRegistered),
      orphanedMeta: false,
    };
  }

  return {
    async queryWorks(query, ctx) {
      return toWorksPage(
        queryWorksByCondition(composeWorks(state), query, ctx),
        requireFixtureRoot(state),
      );
    },

    async groupWorks(query, ctx) {
      return groupWorksByCondition(composeWorks(state), query, ctx);
    },

    async countByConditions(conditions, ctx) {
      return countWorksByConditions(composeWorks(state), conditions, ctx);
    },

    getWorkRegisterPreview,

    async getWork(id: string): Promise<Work | null> {
      const work = state.works.find((w) => w.id === id);
      return work ? buildFullWorkFromState(state, work) : null;
    },

    async prepareWorkPlayback(id: string): Promise<Work | null> {
      const work = state.works.find((w) => w.id === id);
      return work ? buildFullWorkFromState(state, work) : null;
    },

    async createWork(body: WorkCreateBody): Promise<WorkCreateResponse | null> {
      const preview = await getWorkRegisterPreview(body.path);
      if (!preview) return null;
      const rootAbs = normalizeFsPath(requireFixtureRoot(state));
      const workDir = normalizeFsPath(`${rootAbs}/${body.path}`);
      const metaPath = registrationMetaPath(workDir);
      const isFile = workPlacementOf(metaPath).kind === "audio-file";
      assertRegistrationAllowed({
        alreadyRegistered: preview.alreadyRegistered,
        descendantWorkCount: preview.descendantWorkCount,
        kind: isFile ? "file" : "folder",
      });
      const now = new Date().toISOString();
      const rjCode = body.rjCode === "" ? null : body.rjCode;
      const plan = planDlsiteRegistration({
        rjCode,
        info: rjCode ? (fixtureUsableDlsite(state, rjCode)?.info ?? null) : null,
        title: body.title,
        tags: body.tags,
        apply: { title: false, tags: false, cover: body.applyCover, url: body.applyUrl },
      });
      const work: FixtureWorkRecord = {
        id: crypto.randomUUID(),
        title: body.title,
        cover: null,
        status: "ok",
        physicalPath: workDir,
        metaPath,
        totalDurationSec: 0,
        trackCount: isFile ? 1 : 0,
        addedAt: now,
        errorMessage: null,
        urls: plan.dlsiteUrl ? [plan.dlsiteUrl] : [],
        tags: plan.tags,
        bookmarked: false,
        lastPlayedAt: null,
      };
      const coverSkipped = applyFixtureCachedCover(state, work, plan.coverUrl);
      const registered = checkWorkPlacement(state, work);
      state.works.push(registered);
      state.sourceRevisions.set(work.id, "fixture");
      setDlsiteLinkage(state, work.id, plan.dlsite);
      return {
        snapshot: fixtureEditSnapshot(state, registered),
        projection: { status: "published" },
        coverSkipped,
      };
    },

    async reassignIdentityConflict(
      body: IdentityConflictReassignBody,
    ): Promise<WorkSourceMutationResult | null> {
      const diagnostic = state.identityConflicts.find((candidate) =>
        candidate.paths.includes(body.path),
      );
      if (!diagnostic) return null;
      const owner = state.works.find((candidate) => candidate.id === diagnostic.workId);
      const rootAbs = normalizeFsPath(requireFixtureRoot(state));
      const target = normalizeFsPath(`${rootAbs}/${body.path}`);
      const metaPath = metaPathOfTarget(target);
      const newId = crypto.randomUUID();
      const placementOf = (conflictTarget: string) => {
        const conflictMetaPath = metaPathOfTarget(conflictTarget);
        const isFolder = workPlacementOf(conflictMetaPath).kind === "folder";
        return {
          metaPath: conflictMetaPath,
          physicalPath: isFolder
            ? conflictTarget
            : posix.join(
                posix.dirname(conflictTarget),
                owner
                  ? posix.basename(owner.physicalPath)
                  : `${posix.basename(conflictTarget, META_SIDECAR_SUFFIX)}.mp3`,
              ),
        };
      };
      const template: FixtureWorkRecord = owner ?? {
        id: newId,
        title: posix.basename(target, META_SIDECAR_SUFFIX),
        cover: null,
        status: "ok",
        physicalPath: target,
        metaPath,
        totalDurationSec: 0,
        trackCount: workPlacementOf(metaPath).kind === "folder" ? 0 : 1,
        addedAt: new Date().toISOString(),
        errorMessage: null,
        urls: [],
        tags: [],
        bookmarked: false,
        lastPlayedAt: null,
      };
      const reassigned = checkWorkPlacement(state, {
        ...template,
        id: newId,
        ...placementOf(target),
        bookmarked: false,
        lastPlayedAt: null,
      });
      if (owner) copyWorkState(state, diagnostic.workId, newId);
      state.sourceRevisions.set(newId, "fixture");
      if (owner && metaPath === owner.metaPath) {
        // 旧IDの行は、旧IDを宣言している残りのメタファイルへ移る。無ければ行方不明（realと同じ）
        const remaining = diagnostic.paths.find((path) => path !== body.path);
        if (remaining) {
          const moved = checkWorkPlacement(state, {
            ...owner,
            ...placementOf(normalizeFsPath(`${rootAbs}/${remaining}`)),
          });
          state.works = state.works.map((work) => (work === owner ? moved : work));
        } else {
          // 旧IDを宣言するメタファイルが残っていないので、次のスキャンと同じく行方不明にする
          owner.status = "missing";
          owner.errorMessage = null;
        }
      }
      state.works.push(reassigned);
      state.identityConflicts = removeIdentityConflictPath(
        state.identityConflicts,
        diagnostic.workId,
        body.path,
      );
      return {
        snapshot: fixtureEditSnapshot(state, reassigned),
        projection: { status: "published" },
      };
    },

    async projectWorkSource(path: WorkspacePath): Promise<WorkSourceMutationResult | null> {
      const rootAbs = normalizeFsPath(requireFixtureRoot(state));
      const target = normalizeFsPath(`${rootAbs}/${path}`);
      if (!isPathWithin(rootAbs, target, posix)) return null;
      const work = state.works.find((candidate) => candidate.physicalPath === target);
      if (!work) return null;
      return { snapshot: fixtureEditSnapshot(state, work), projection: { status: "published" } };
    },

    async reloadWork(id: string): Promise<boolean> {
      const warning = state.dataIntegrityWarning;
      if (warning?.skippedWorkIds.includes(id)) {
        const rest = warning.skippedWorkIds.filter((skipped) => skipped !== id);
        state.dataIntegrityWarning = rest.length
          ? { skippedCount: rest.length, skippedWorkIds: rest }
          : undefined;
        return true;
      }
      return state.works.some((w) => w.id === id);
    },

    async deleteWork(id: string): Promise<boolean> {
      if (!state.works.some((w) => w.id === id)) return false;
      removeIdentityConflictForWork(state, id);
      removeWorks(state, new Set([id]));
      return true;
    },

    async getWorkStatuses(ids: readonly string[]): Promise<Map<string, Work["status"]>> {
      const wanted = new Set(ids);
      const statuses = new Map<string, Work["status"]>(
        state.works.filter((work) => wanted.has(work.id)).map((work) => [work.id, work.status]),
      );
      // データ不整合で一覧から除かれた作品も、catalogには存在する
      for (const id of state.dataIntegrityWarning?.skippedWorkIds ?? []) {
        if (wanted.has(id) && !statuses.has(id)) statuses.set(id, "error");
      }
      return statuses;
    },

    async countMissingWorks(): Promise<number> {
      return state.works.filter((w) => w.status === "missing").length;
    },

    async unregisterMissingWorks(): Promise<UnregisterMissingWorksResult> {
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
      const fullWork = buildFullWorkFromState(state, work);
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
