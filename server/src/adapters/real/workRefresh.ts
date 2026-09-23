import type { Work } from "@mimimilli/shared";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import { cachedFileProbeMap, liveFileProbeMap } from "./workProbe.ts";
import { rowToWork } from "./workRowMapping.ts";
import type { Db } from "./db.ts";

export function getWorkFromCatalog(query: WorkQueryRepository, id: string): Work | null {
  const detail = query.fetchWorkDetail(id);
  if (!detail) return null;
  const probes = cachedFileProbeMap(detail.row.physicalPath, detail.rawPlaylists, (paths) =>
    query.fetchProbeCache(paths),
  );
  return rowToWork(detail.row, detail.rawPlaylists, detail.tagNames, detail.dlsite, probes, {
    totalDurationFromCatalog: true,
  });
}

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
