import type { Work, WorkSummary } from "@mimimilli/shared";
import {
  META_FILE_NAME,
  coverFieldsFromCover,
  emptyDlsiteState,
  toTrackDurationFieldsFromSec,
  workPlacementOf,
} from "@mimimilli/shared";
import type { ResumeBody } from "@mimimilli/shared";
import type { Db } from "../../src/adapters/real/db.ts";
import { CatalogWorkRepository } from "../../src/adapters/real/catalogWorkRepository.ts";
import { UserWorkStateRepository } from "../../src/adapters/real/userWorkStateRepository.ts";
import { WorkQueryRepository } from "../../src/adapters/real/workQueryRepository.ts";
import { getWorkFromCatalog } from "../../src/adapters/real/workRefresh.ts";
import type { ListSummariesResult } from "../../src/adapters/real/workRowMapping.ts";
import { validateResumeRequest } from "../../src/core/resumeValidation.ts";

export function makeWork(overrides: Partial<Work> & Pick<Work, "id">): Work {
  const playlistId = crypto.randomUUID();
  const trackId = crypto.randomUUID();
  const { id, ...rest } = overrides;
  return {
    id,
    title: `作品 ${id}`,
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: 10,
    addedAt: "2026-07-19T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [
          {
            id: trackId,
            title: "track",
            file: "track.wav",
            ...resolvedDuration(60),
          },
        ],
      },
    ],
    bookmarked: false,
    lastPlayedAt: null,
    resume: null,
    dlsite: emptyDlsiteState(),
    ...rest,
  };
}

export function makeWorkSummary(overrides: Partial<WorkSummary> = {}): WorkSummary {
  return {
    id: "work-1",
    title: "テスト作品",
    cover: null,
    status: "ok",
    physicalPath: "/library/work-1",
    totalDurationSec: 120,
    addedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    ...overrides,
  };
}

export function saveTestResume(
  catalog: CatalogWorkRepository,
  user: UserWorkStateRepository,
  id: string,
  body: ResumeBody,
): boolean {
  const track = catalog.resolveResumeTrackDuration(id, body.playlistId, body.trackId);
  validateResumeRequest(track, body.offsetSec);
  return user.saveResume(id, body);
}

export async function getTestWork(db: Db, id: string) {
  const { query } = createWorkRepos(db);
  return getWorkFromCatalog(query, id);
}

export function createWorkRepos(db: Db) {
  return {
    query: new WorkQueryRepository(db),
    catalog: new CatalogWorkRepository(db),
    user: new UserWorkStateRepository(db),
  };
}

/** テスト用 ResolvedTrack の durationSec + durationKind */
export function resolvedDuration(durationSec: number | null) {
  return toTrackDurationFieldsFromSec(durationSec);
}

export function upsertTestWork(
  catalog: CatalogWorkRepository,
  user: UserWorkStateRepository,
  work: Work,
  metaPath?: string,
): void {
  const { coverKind, coverImage } = coverFieldsFromCover(work.cover);
  user.upsertWorkUserState({ ...work, coverKind, coverImage });
  catalog.upsertWorkCatalog(
    { ...work, coverKind, coverImage },
    { metaPath: metaPath ?? folderMetaPath(work.physicalPath) },
  );
}

/** フォルダー形式作品のテスト用メタパス（physicalPath 直下の mimimilli.json） */
export function folderMetaPath(physicalPath: string): string {
  return `${physicalPath}/mimimilli.json`;
}

/** 一覧結果の組み立て。summaries はすべてフォルダー形式の作品として配置を付ける */
export function folderSummariesResult(
  result: Omit<ListSummariesResult, "placements">,
): ListSummariesResult {
  return {
    ...result,
    placements: new Map(
      result.summaries.map((summary) => [
        summary.id,
        workPlacementOf(`${summary.physicalPath}/${META_FILE_NAME}`),
      ]),
    ),
  };
}
