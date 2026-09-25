import type { Work } from "@mimimilli/shared";
import type { Db } from "./db.ts";
import type { ScanWorkState } from "./workRowMapping.ts";

export function getScanWorkMap(db: Db): Map<string, ScanWorkState> {
  const rows = db.sqlite
    .query(
      `
          SELECT
            works.id AS id,
            works.source_revision AS sourceRevision,
            works.projection_revision AS projectionRevision,
            works.media_revision AS mediaRevision,
            works.status AS status,
            works.physical_path AS physicalPath,
            works.meta_path AS metaPath,
            works.cover_image AS coverImage,
            works.cover_width AS coverWidth,
            works.cover_height AS coverHeight,
            work_states.added_at AS addedAt,
            work_states.bookmarked AS bookmarked,
            work_states.last_played_at AS lastPlayedAt,
            work_states.resume_playlist_id AS resumePlaylistId,
            work_states.resume_track_id AS resumeTrackId,
            work_states.resume_offset_sec AS resumeOffsetSec
          FROM main.works AS works
          INNER JOIN user.work_states AS work_states ON work_states.work_id = works.id
        `,
    )
    .all() as Array<{
    id: string;
    sourceRevision: string | null;
    projectionRevision: string | null;
    mediaRevision: string | null;
    status: Work["status"];
    physicalPath: string;
    metaPath: string;
    coverImage: string | null;
    coverWidth: number | null;
    coverHeight: number | null;
    addedAt: string;
    bookmarked: number;
    lastPlayedAt: string | null;
    resumePlaylistId: string | null;
    resumeTrackId: string | null;
    resumeOffsetSec: number | null;
  }>;
  const map = new Map<string, ScanWorkState>();
  for (const row of rows) {
    map.set(row.id, {
      metaPath: row.metaPath,
      sourceRevision: row.sourceRevision,
      projectionRevision: row.projectionRevision,
      mediaRevision: row.mediaRevision,
      status: row.status,
      physicalPath: row.physicalPath,
      addedAt: row.addedAt,
      bookmarked: row.bookmarked !== 0,
      lastPlayedAt: row.lastPlayedAt,
      cover: {
        image: row.coverImage,
        dimensions:
          row.coverWidth !== null && row.coverHeight !== null
            ? { width: row.coverWidth, height: row.coverHeight }
            : null,
      },
      resume:
        row.resumePlaylistId !== null && row.resumeTrackId !== null && row.resumeOffsetSec !== null
          ? {
              playlistId: row.resumePlaylistId,
              trackId: row.resumeTrackId,
              offsetSec: row.resumeOffsetSec,
            }
          : null,
    });
  }
  return map;
}
