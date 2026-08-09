import type { Work } from "@mimimilli/shared";
import { coverFieldsFromCover, toTrackDurationFieldsFromSec } from "@mimimilli/shared";
import type { ResumeBody } from "@mimimilli/shared";
import type { Db } from "../../src/adapters/real/db.ts";
import { CatalogWorkRepository } from "../../src/adapters/real/catalogWorkRepository.ts";
import { UserWorkStateRepository } from "../../src/adapters/real/userWorkStateRepository.ts";
import { WorkQueryRepository } from "../../src/adapters/real/workQueryRepository.ts";
import { getWorkWithLiveProbe } from "../../src/adapters/real/workRefresh.ts";

export function saveTestResume(
  catalog: CatalogWorkRepository,
  user: UserWorkStateRepository,
  id: string,
  body: ResumeBody,
): boolean {
  const track = catalog.resolveResumeTrackDuration(id, body.playlistId, body.trackId);
  return user.saveResume(id, body, track);
}

export async function getTestWork(db: Db, id: string) {
  const { query, catalog } = createWorkRepos(db);
  return getWorkWithLiveProbe(db, query, catalog, id);
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
