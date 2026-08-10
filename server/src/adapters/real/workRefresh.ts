import type { Work } from "@mimimilli/shared";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import { liveFileProbeMap } from "./workProbe.ts";
import { rowToWork } from "./workRowMapping.ts";
import type { Db } from "./db.ts";

export async function resolveWorkWithLiveProbe(
  db: Db,
  query: WorkQueryRepository,
  catalog: CatalogWorkRepository,
  detail: NonNullable<ReturnType<WorkQueryRepository["fetchWorkDetail"]>>,
): Promise<Work> {
  const liveProbes = await liveFileProbeMap(
    db,
    detail.row.physicalPath,
    detail.rawPlaylists,
    (paths) => query.fetchProbeCache(paths),
  );
  const work = rowToWork(
    detail.row,
    detail.rawPlaylists,
    detail.tagNames,
    detail.dlsite,
    liveProbes,
  );
  catalog.syncTotalDurationSec(detail.row, work.totalDurationSec);
  return work;
}

export async function getWorkWithLiveProbe(
  db: Db,
  query: WorkQueryRepository,
  catalog: CatalogWorkRepository,
  id: string,
): Promise<Work | null> {
  const detail = query.fetchWorkDetail(id);
  if (!detail) return null;
  return resolveWorkWithLiveProbe(db, query, catalog, detail);
}

export async function getWorkByPhysicalPathWithLiveProbe(
  db: Db,
  query: WorkQueryRepository,
  catalog: CatalogWorkRepository,
  physicalPath: string,
): Promise<Work | null> {
  const detail = query.fetchWorkDetailByPhysicalPath(physicalPath);
  if (!detail) return null;
  return resolveWorkWithLiveProbe(db, query, catalog, detail);
}
