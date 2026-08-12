import { join } from "node:path";
import { eq, inArray } from "drizzle-orm";
import { parseTag, probeResultFromCache, resolveTrackDurationSec } from "@mimimilli/shared";
import type { NormalizedTag, DlsiteState, ScanDiagnostic, UrlEntry, Work } from "@mimimilli/shared";
import { japaneseSortKey } from "../../core/japaneseSortKey.ts";
import type { Db } from "./db.ts";
import {
  audioProbeCache,
  identityConflicts,
  playlists as catalogPlaylists,
  scanState,
  tags,
  tracks as catalogTracks,
  workDlsite,
  workTags,
  works,
} from "./catalogSchema.ts";
import {
  coverColumnsFromWork,
  defaultPlaylistOf,
  type CoverColumns,
  type WorkRow,
} from "./workRowMapping.ts";
import { chunk } from "./workQuerySql.ts";

const CATALOG_ID_DELETE_CHUNK_SIZE = 500;

export class CatalogWorkRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  private replaceWorkTags(workId: string, tagNames: NormalizedTag[]): void {
    this.db.catalog.delete(workTags).where(eq(workTags.workId, workId)).run();
    for (const name of tagNames) {
      const parsed = parseTag(name);
      this.db.catalog
        .insert(tags)
        .values({
          name,
          searchKey: japaneseSortKey(name),
          facetSortKey: japaneseSortKey(parsed.kind === "annotated" ? parsed.value : name),
        })
        .onConflictDoNothing()
        .run();
      const tag = this.db.catalog.select().from(tags).where(eq(tags.name, name)).get();
      if (tag) {
        this.db.catalog
          .insert(workTags)
          .values({ workId, tagId: tag.id })
          .onConflictDoNothing()
          .run();
      }
    }
  }

  setDlsiteState(workId: string, state: DlsiteState): void {
    this.db.catalog
      .insert(workDlsite)
      .values({ workId, stateJson: JSON.stringify(state) })
      .onConflictDoUpdate({
        target: workDlsite.workId,
        set: { stateJson: JSON.stringify(state) },
      })
      .run();
  }

  replaceIdentityConflicts(diagnostics: ScanDiagnostic[]): void {
    this.db.catalog.delete(identityConflicts).run();
    for (const diagnostic of diagnostics) {
      for (const path of diagnostic.paths) {
        this.db.catalog.insert(identityConflicts).values({ workId: diagnostic.workId, path }).run();
      }
    }
  }

  listIdentityConflicts(): ScanDiagnostic[] {
    const rows = this.db.catalog
      .select()
      .from(identityConflicts)
      .orderBy(identityConflicts.workId, identityConflicts.path)
      .all();
    const grouped = new Map<string, string[]>();
    for (const row of rows) {
      const paths = grouped.get(row.workId) ?? [];
      paths.push(row.path);
      grouped.set(row.workId, paths);
    }
    return [...grouped].map(([workId, paths]) => ({ kind: "identity_conflict", workId, paths }));
  }

  syncTotalDurationSec(row: WorkRow, liveTotalDurationSec: number | null): void {
    if (row.totalDurationSec === liveTotalDurationSec) return;
    this.db.catalog
      .update(works)
      .set({ totalDurationSec: liveTotalDurationSec })
      .where(eq(works.id, row.id))
      .run();
  }

  getWorkMetaPath(id: string): string | null {
    const row = this.db.catalog
      .select({ metaPath: works.metaPath })
      .from(works)
      .where(eq(works.id, id))
      .get();
    return row?.metaPath ?? null;
  }

  getWorkDeleteTarget(id: string): { metaPath: string } | null {
    const row = this.db.catalog
      .select({ id: works.id, metaPath: works.metaPath })
      .from(works)
      .where(eq(works.id, id))
      .get();
    return row ? { metaPath: row.metaPath } : null;
  }

  deleteWorkCatalog(id: string): boolean {
    const row = this.getWorkDeleteTarget(id);
    if (!row) return false;
    this.db.transaction(() => {
      this.db.catalog.delete(workTags).where(eq(workTags.workId, id)).run();
      this.db.catalog.delete(workDlsite).where(eq(workDlsite.workId, id)).run();
      this.db.catalog.delete(works).where(eq(works.id, id)).run();
    });
    return true;
  }

  upsertWorkCatalog(
    work: Work,
    options: {
      metaPath: string;
      revisions?: { sourceRevision: string; projectionRevision: string; mediaRevision: string };
      cover?: CoverColumns;
    },
  ): void {
    const trackCount =
      defaultPlaylistOf({ id: work.id, defaultPlaylistId: work.defaultPlaylistId }, work.playlists)
        ?.tracks.length ?? 0;
    const cover = options.cover ?? coverColumnsFromWork(work);
    const values: typeof works.$inferInsert = {
      id: work.id,
      title: work.title,
      titleSortKey: japaneseSortKey(work.title),
      coverImage: cover.image,
      coverWidth: cover.dimensions?.width ?? null,
      coverHeight: cover.dimensions?.height ?? null,
      defaultPlaylistId: work.defaultPlaylistId,
      createdAt: work.createdAt,
      status: work.status,
      physicalPath: work.physicalPath,
      metaPath: options.metaPath,
      totalDurationSec: work.totalDurationSec,
      trackCount,
      sourceRevision: options.revisions?.sourceRevision ?? null,
      projectionRevision: options.revisions?.projectionRevision ?? null,
      mediaRevision: options.revisions?.mediaRevision ?? null,
      verificationStatus: "verified",
      errorMessage: work.errorMessage,
      urlsJson: JSON.stringify(work.urls),
      playlistsJson: JSON.stringify(
        work.playlists.map((playlist) => ({
          id: playlist.id,
          name: playlist.name,
          tracks: playlist.tracks.map(
            ({ durationSec: _durationSec, durationKind: _durationKind, ...track }) => track,
          ),
        })),
      ),
    };
    this.db.catalog
      .insert(works)
      .values(values)
      .onConflictDoUpdate({ target: works.id, set: values })
      .run();
    this.db.catalog.delete(catalogPlaylists).where(eq(catalogPlaylists.workId, work.id)).run();
    const playlistIds = work.playlists.map((playlist) => playlist.id);
    const trackIds = work.playlists.flatMap((playlist) => playlist.tracks.map((track) => track.id));
    for (const idsChunk of chunk(playlistIds, CATALOG_ID_DELETE_CHUNK_SIZE)) {
      if (idsChunk.length === 0) continue;
      this.db.catalog.delete(catalogPlaylists).where(inArray(catalogPlaylists.id, idsChunk)).run();
    }
    for (const idsChunk of chunk(trackIds, CATALOG_ID_DELETE_CHUNK_SIZE)) {
      if (idsChunk.length === 0) continue;
      this.db.catalog.delete(catalogTracks).where(inArray(catalogTracks.id, idsChunk)).run();
    }
    for (let playlistPosition = 0; playlistPosition < work.playlists.length; playlistPosition++) {
      const playlist = work.playlists[playlistPosition]!;
      this.db.catalog
        .insert(catalogPlaylists)
        .values({
          id: playlist.id,
          workId: work.id,
          position: playlistPosition,
          name: playlist.name,
        })
        .run();
      for (let trackPosition = 0; trackPosition < playlist.tracks.length; trackPosition++) {
        const track = playlist.tracks[trackPosition]!;
        this.db.catalog
          .insert(catalogTracks)
          .values({
            id: track.id,
            playlistId: playlist.id,
            workId: work.id,
            position: trackPosition,
            title: track.title,
            file: track.file,
            start: track.start,
            end: track.end,
          })
          .run();
      }
    }
    this.replaceWorkTags(work.id, work.tags);
    this.setDlsiteState(work.id, work.dlsite);
  }

  patchWorkCatalog(
    id: string,
    patch: {
      title?: string;
      tags?: NormalizedTag[];
      cover?: CoverColumns;
      urls?: UrlEntry[];
    },
  ): { metaPath: string } | null {
    const row = this.db.catalog.select().from(works).where(eq(works.id, id)).get();
    if (!row) return null;
    const set: Partial<typeof works.$inferInsert> = {};
    if (patch.title !== undefined) {
      set.title = patch.title;
      set.titleSortKey = japaneseSortKey(patch.title);
    }
    if (patch.cover !== undefined) {
      set.coverImage = patch.cover.image;
      set.coverWidth = patch.cover.dimensions?.width ?? null;
      set.coverHeight = patch.cover.dimensions?.height ?? null;
    }
    if (patch.urls !== undefined) set.urlsJson = JSON.stringify(patch.urls);
    if (Object.keys(set).length > 0) {
      this.db.catalog.update(works).set(set).where(eq(works.id, id)).run();
    }
    if (patch.tags !== undefined) {
      this.replaceWorkTags(id, patch.tags);
    }
    return { metaPath: row.metaPath };
  }

  markWorkError(id: string, physicalPath: string, metaPath: string, errorMessage: string): boolean {
    return (
      this.db.catalog
        .update(works)
        .set({ status: "error", physicalPath, metaPath, errorMessage })
        .where(eq(works.id, id))
        .returning({ id: works.id })
        .get() !== undefined
    );
  }

  markMissingExcept(foundIds: string[], unverifiedIds: string[] = []): void {
    const set = { status: "missing", errorMessage: null } as const;
    if (foundIds.length === 0) {
      if (unverifiedIds.length === 0) {
        this.db.catalog
          .update(works)
          .set({ ...set, verificationStatus: "verified" })
          .run();
      } else {
        this.db.catalog
          .update(works)
          .set({ verificationStatus: "unverified" })
          .where(inArray(works.id, unverifiedIds))
          .run();
        this.db.sqlite.exec(
          "UPDATE main.works SET status = 'missing', error_message = NULL, verification_status = 'verified' " +
            "WHERE id NOT IN (SELECT id FROM main.works WHERE verification_status = 'unverified')",
        );
      }
      return;
    }
    const sqlite = this.db.sqlite;
    sqlite.exec("DROP TABLE IF EXISTS temp.scan_seen_ids");
    sqlite.exec("CREATE TEMP TABLE scan_seen_ids (id TEXT PRIMARY KEY)");
    try {
      const insert = sqlite.prepare("INSERT INTO temp.scan_seen_ids (id) VALUES (?)");
      for (const id of foundIds) insert.run(id);
      const insertUnverified = sqlite.prepare(
        "INSERT OR IGNORE INTO temp.scan_seen_ids (id) VALUES (?)",
      );
      for (const id of unverifiedIds) insertUnverified.run(id);
      if (unverifiedIds.length > 0) {
        const placeholders = unverifiedIds.map(() => "?").join(",");
        sqlite
          .query(
            `UPDATE main.works SET verification_status = 'unverified' WHERE id IN (${placeholders})`,
          )
          .run(...unverifiedIds);
      }
      sqlite.exec(
        "UPDATE main.works SET status = 'missing', error_message = NULL, verification_status = 'verified' " +
          "WHERE id NOT IN (SELECT id FROM temp.scan_seen_ids)",
      );
      sqlite.exec(
        "UPDATE main.works SET verification_status = 'verified' " +
          "WHERE id IN (SELECT id FROM temp.scan_seen_ids) AND verification_status <> 'unverified'",
      );
    } finally {
      sqlite.exec("DROP TABLE IF EXISTS temp.scan_seen_ids");
    }
  }

  countByStatus(status: string): number {
    const row = this.db.sqlite
      .query("SELECT COUNT(*) AS count FROM main.works WHERE status = ?")
      .get(status) as { count: number };
    return row.count;
  }

  getScanState(key: string): string | null {
    const row = this.db.catalog.select().from(scanState).where(eq(scanState.key, key)).get();
    return row?.value ?? null;
  }

  setScanState(key: string, value: string | null): void {
    this.db.catalog
      .insert(scanState)
      .values({ key, value })
      .onConflictDoUpdate({ target: scanState.key, set: { value } })
      .run();
  }

  resolveResumeTrackDuration(
    workId: string,
    playlistId: string,
    trackId: string,
  ): { durationSec: number | null; physicalPath: string; file: string } | null {
    const track = this.db.sqlite
      .query(`
        SELECT tracks.start, tracks.end, tracks.file,
               works.physical_path AS physicalPath
        FROM main.playlists
        INNER JOIN main.tracks ON tracks.playlist_id = playlists.id
        INNER JOIN main.works ON works.id = playlists.work_id
        WHERE playlists.work_id = ? AND playlists.id = ?
          AND tracks.work_id = ? AND tracks.id = ?
      `)
      .get(workId, playlistId, workId, trackId) as {
      start: number | null;
      end: number | null;
      file: string;
      physicalPath: string;
    } | null;
    if (!track) return null;
    const cacheRow = this.db.catalog
      .select({ durationSec: audioProbeCache.durationSec })
      .from(audioProbeCache)
      .where(eq(audioProbeCache.path, join(track.physicalPath, track.file)))
      .get();
    const probe =
      track.end !== null ? ({ kind: "unprobed" } as const) : probeResultFromCache(cacheRow);
    const durationSec = resolveTrackDurationSec(
      { start: track.start ?? undefined, end: track.end ?? undefined },
      probe,
    );
    return { durationSec, physicalPath: track.physicalPath, file: track.file };
  }

  workExists(id: string): boolean {
    return (
      this.db.catalog.select({ id: works.id }).from(works).where(eq(works.id, id)).get() !==
      undefined
    );
  }
}
