import { and, eq } from "drizzle-orm";
import type { Db } from "./db.ts";
import { tracks } from "./catalogSchema.ts";
import { workPlacementOf, type WorkPlacement } from "@mimimilli/shared";
import type { CoverLocation } from "./workRowMapping.ts";

export function getCoverLocation(db: Db, id: string): CoverLocation | null {
  const row = db.sqlite
    .query(
      `SELECT id, meta_path AS metaPath, cover_image AS coverImage
         FROM main.works WHERE id = ?`,
    )
    .get(id) as { id: string; metaPath: string; coverImage: string | null } | null;
  return row
    ? { id: row.id, placement: workPlacementOf(row.metaPath), coverImage: row.coverImage }
    : null;
}

export function getWorkPlacement(db: Db, id: string): WorkPlacement | null {
  const row = db.sqlite
    .query(`SELECT meta_path AS metaPath FROM main.works WHERE id = ?`)
    .get(id) as { metaPath: string } | null;
  return row ? workPlacementOf(row.metaPath) : null;
}

export function hasTrackFile(db: Db, workId: string, file: string): boolean {
  return (
    db.catalog
      .select({ id: tracks.id })
      .from(tracks)
      .where(and(eq(tracks.workId, workId), eq(tracks.file, file)))
      .limit(1)
      .get() !== undefined
  );
}
