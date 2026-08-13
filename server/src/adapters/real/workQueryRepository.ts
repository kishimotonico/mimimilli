import { sep } from "node:path";
import { asc, eq } from "drizzle-orm";
import {
  coverFieldsFromColumns,
  createRandomSeed,
  evaluateParseErrorAlert,
  folderNameFromPhysicalPath,
  toWorkListItemDlsite,
  withNormalizeTagBatchCache,
} from "@mimimilli/shared";
import type {
  AxisFacetItem,
  DlsiteNotificationKind,
  DlsiteNotificationPage,
  DlsiteNotificationQuery,
  DlsiteNotificationSummary,
  SmartFolderRule,
  Work,
  WorksPage,
  WorksQuery,
} from "@mimimilli/shared";
import type { AxisFacetsQuery } from "@mimimilli/shared";
import { japaneseSortKey } from "../../core/japaneseSortKey.ts";
import type { Db } from "./db.ts";
import { tags, workDlsite, workTags, works } from "./catalogSchema.ts";
import {
  likeDescendantsPrefix,
  likeStrictDescendantPrefixSql,
  SQL_LIKE_ESCAPE_CLAUSE,
} from "./paths.ts";
import type { ProbeCacheEntry } from "./probe.ts";
import {
  axisFacetSql,
  chunk,
  dlsiteNotificationWhere,
  DLSITE_NOTIFICATION_SUMMARY_SELECT,
  inClausePlaceholders,
  JOINED_WORKS_SELECT,
  smartFolderRulePredicates,
  SQLITE_IN_CHUNK_SIZE,
  tagAxisConditions,
  textSearchCondition,
  viewConditions,
  WORKS_QUERY_FROM,
  worksOrderSql,
} from "./workQuerySql.ts";
import {
  type AxisFacetRow,
  type CoverLocationRow,
  type ListSummariesResult,
  type MediaRootRow,
  mapRawWorkRows,
  parseDlsiteStateJson,
  type RawPlaylistRow,
  type RawSummaryListRow,
  type RawWorkListRow,
  type RawWorkRow,
  type ScanWorkState,
  type SummaryRow,
  rowToSummary,
  type WorkDetailParts,
  type WorkRow,
  PersistentDataError,
} from "./workRowMapping.ts";

export class WorkQueryRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  private tagMap(workIds?: string[]): Map<string, string[]> {
    const baseSql = `
      SELECT work_tags.work_id AS workId, tags.name AS name
      FROM main.work_tags AS work_tags
      INNER JOIN main.tags AS tags ON tags.id = work_tags.tag_id
    `;
    const rows = (
      workIds === undefined
        ? this.db.sqlite.query(baseSql).all()
        : chunk(workIds, SQLITE_IN_CHUNK_SIZE).flatMap((idsChunk) =>
            this.db.sqlite
              .query(
                `${baseSql} WHERE work_tags.work_id IN (${inClausePlaceholders(idsChunk.length)})`,
              )
              .all(...idsChunk),
          )
    ) as Array<{ workId: string; name: string }>;
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const list = map.get(r.workId);
      if (list) list.push(r.name);
      else map.set(r.workId, [r.name]);
    }
    return map;
  }

  private circleNameMap(workIds: string[]): Map<string, string> {
    if (workIds.length === 0) return new Map();
    const rows = chunk(workIds, SQLITE_IN_CHUNK_SIZE).flatMap(
      (idsChunk) =>
        this.db.sqlite
          .query(
            `
            SELECT work_tags.work_id AS workId, tags.name AS name
            FROM main.work_tags AS work_tags
            INNER JOIN main.tags AS tags ON tags.id = work_tags.tag_id
            WHERE work_tags.work_id IN (${inClausePlaceholders(idsChunk.length)})
              AND (tags.name LIKE 'サークル/%' OR tags.name LIKE 'circle/%')
            ORDER BY work_tags.work_id, tags.name COLLATE BINARY ASC
          `,
          )
          .all(...idsChunk) as Array<{ workId: string; name: string }>,
    );
    const map = new Map<string, string>();
    for (const row of rows) {
      if (!map.has(row.workId)) map.set(row.workId, row.name.slice(row.name.indexOf("/") + 1));
    }
    return map;
  }

  private joinedWorks(whereSql = "", ...parameters: string[]): WorkRow[] {
    const sql = `${JOINED_WORKS_SELECT} ${whereSql}`;
    const rows =
      parameters.length > 0
        ? this.db.sqlite.query(sql).all(...parameters)
        : this.db.sqlite.query(sql).all();
    return mapRawWorkRows(rows as RawWorkRow[]);
  }

  private dlsiteState(workId: string) {
    const row = this.db.catalog
      .select()
      .from(workDlsite)
      .where(eq(workDlsite.workId, workId))
      .get();
    return parseDlsiteStateJson(workId, row?.stateJson ?? null);
  }

  private playlistsForWork(workId: string): RawPlaylistRow[] {
    const rows = this.db.sqlite
      .query(
        `
          SELECT
            playlists.id AS playlistId,
            playlists.name AS playlistName,
            playlists.position AS playlistPosition,
            tracks.id AS trackId,
            tracks.title AS trackTitle,
            tracks.file AS trackFile,
            tracks.start AS trackStart,
            tracks.end AS trackEnd,
            tracks.position AS trackPosition
          FROM main.playlists AS playlists
          LEFT JOIN main.tracks AS tracks
            ON tracks.work_id = playlists.work_id
           AND tracks.playlist_id = playlists.id
          WHERE playlists.work_id = ?
          ORDER BY playlists.position ASC, playlists.id COLLATE BINARY ASC,
                   tracks.position ASC, tracks.id COLLATE BINARY ASC
        `,
      )
      .all(workId) as Array<{
      playlistId: string;
      playlistName: string;
      playlistPosition: number;
      trackId: string | null;
      trackTitle: string | null;
      trackFile: string | null;
      trackStart: number | null;
      trackEnd: number | null;
      trackPosition: number | null;
    }>;
    const playlistsById = new Map<string, RawPlaylistRow>();
    for (const row of rows) {
      let playlist = playlistsById.get(row.playlistId);
      if (!playlist) {
        playlist = {
          id: row.playlistId,
          name: row.playlistName,
          position: row.playlistPosition,
          tracks: [],
        };
        playlistsById.set(row.playlistId, playlist);
      }
      if (
        row.trackId !== null &&
        row.trackTitle !== null &&
        row.trackFile !== null &&
        row.trackPosition !== null
      ) {
        playlist.tracks.push({
          id: row.trackId,
          title: row.trackTitle,
          file: row.trackFile,
          start: row.trackStart,
          end: row.trackEnd,
          position: row.trackPosition,
        });
      }
    }
    return [...playlistsById.values()];
  }

  fetchWorkDetail(id: string): WorkDetailParts | null {
    const row = this.joinedWorks("WHERE works.id = ?", id)[0];
    if (!row) return null;
    return {
      row,
      rawPlaylists: this.playlistsForWork(id),
      tagNames: this.tagMap([id]).get(id) ?? [],
      dlsite: this.dlsiteState(id),
    };
  }

  fetchWorkDetailByPhysicalPath(physicalPath: string): WorkDetailParts | null {
    const row = this.joinedWorks("WHERE works.physical_path = ?", physicalPath)[0];
    if (!row) return null;
    return {
      row,
      rawPlaylists: this.playlistsForWork(row.id),
      tagNames: this.tagMap([row.id]).get(row.id) ?? [],
      dlsite: this.dlsiteState(row.id),
    };
  }

  listSummaries(workIds?: string[]): ListSummariesResult {
    return withNormalizeTagBatchCache(() => {
      if (workIds !== undefined && workIds.length === 0) {
        return { summaries: [], skipped: [] };
      }

      const baseSql = `
      SELECT
        works.id,
        works.title,
        works.cover_image AS coverImage,
        works.cover_width AS coverWidth,
        works.cover_height AS coverHeight,
        works.status,
        works.physical_path AS physicalPath,
        works.total_duration_sec AS totalDurationSec,
        works.track_count AS trackCount,
        works.error_message AS errorMessage,
        works.urls_json AS urlsJson,
        work_states.added_at AS addedAt,
        work_states.bookmarked,
        work_states.last_played_at AS lastPlayedAt,
        work_dlsite.state_json AS dlsiteStateJson
      FROM main.works
      INNER JOIN user.work_states AS work_states ON work_states.work_id = works.id
      LEFT JOIN main.work_dlsite AS work_dlsite ON work_dlsite.work_id = works.id
    `;
      const rows: RawSummaryListRow[] =
        workIds === undefined
          ? (this.db.sqlite.query(baseSql).all() as RawSummaryListRow[])
          : chunk(workIds, SQLITE_IN_CHUNK_SIZE).flatMap(
              (idsChunk) =>
                this.db.sqlite
                  .query(`${baseSql} WHERE works.id IN (${inClausePlaceholders(idsChunk.length)})`)
                  .all(...idsChunk) as RawSummaryListRow[],
            );
      const tagsByWork = this.tagMap(workIds);
      const summaries: ListSummariesResult["summaries"] = [];
      const skipped: ListSummariesResult["skipped"] = [];
      for (const rawRow of rows) {
        try {
          const row: SummaryRow = { ...rawRow, bookmarked: rawRow.bookmarked !== 0 };
          summaries.push(
            rowToSummary(
              row,
              tagsByWork.get(row.id) ?? [],
              parseDlsiteStateJson(row.id, rawRow.dlsiteStateJson),
            ),
          );
        } catch (error) {
          if (error instanceof PersistentDataError) {
            skipped.push({ workId: rawRow.id, reason: error.message });
            continue;
          }
          throw error;
        }
      }
      return { summaries, skipped };
    });
  }

  listFsWorkRefs(directoryPath: string): Array<{ id: string; physicalPath: string }> {
    const descendantPrefix = likeDescendantsPrefix(directoryPath);
    return this.db.sqlite
      .query(
        `SELECT works.id AS id, works.physical_path AS physicalPath
         FROM main.works
         INNER JOIN user.work_states ON work_states.work_id = works.id
         WHERE works.physical_path = ?
            OR ? LIKE ${likeStrictDescendantPrefixSql("works.physical_path")}${SQL_LIKE_ESCAPE_CLAUSE}
            OR works.physical_path LIKE ?${SQL_LIKE_ESCAPE_CLAUSE}
         ORDER BY works.rowid ASC`,
      )
      .all(directoryPath, directoryPath, sep, sep, descendantPrefix) as Array<{
      id: string;
      physicalPath: string;
    }>;
  }

  listDescendantWorkRefs(
    parentPath: string,
  ): Array<{ id: string; physicalPath: string; metaPath: string }> {
    const descendantPrefix = likeDescendantsPrefix(parentPath);
    return this.db.sqlite
      .query(
        `SELECT works.id AS id, works.physical_path AS physicalPath, works.meta_path AS metaPath
         FROM main.works
         INNER JOIN user.work_states ON work_states.work_id = works.id
         WHERE works.physical_path != ?
           AND works.physical_path LIKE ?${SQL_LIKE_ESCAPE_CLAUSE}
         ORDER BY works.rowid ASC`,
      )
      .all(parentPath, descendantPrefix) as Array<{
      id: string;
      physicalPath: string;
      metaPath: string;
    }>;
  }

  resolveSmartFolderCandidateIds(rules: SmartFolderRule[]): Set<string> | null {
    if (rules.length === 0) return null;
    const { predicates, bindings } = smartFolderRulePredicates(rules);
    const rows = this.db.sqlite
      .query(`SELECT works.id AS id FROM main.works WHERE ${predicates.join(" OR ")}`)
      .all(...bindings) as Array<{ id: string }>;
    return new Set(rows.map((row) => row.id));
  }

  queryWorks(params: WorksQuery): WorksPage {
    const seed = params.sort === "random" ? (params.seed ?? createRandomSeed()) : undefined;
    const conditions: string[] = [];
    const bindings: Array<string | number> = [];

    if (params.ids !== undefined) {
      conditions.push(
        params.ids.length > 0 ? `works.id IN (${inClausePlaceholders(params.ids.length)})` : "0",
      );
      bindings.push(...params.ids);
    }

    if (params.q) {
      const text = textSearchCondition(japaneseSortKey(params.q), params.q);
      conditions.push(...text.conditions);
      bindings.push(...text.bindings);
    }

    const { tags: realTags, yearValue } = params.tags;
    const tagAxis = tagAxisConditions(realTags, params.tagOp, yearValue);
    conditions.push(...tagAxis.conditions);
    bindings.push(...tagAxis.bindings);

    const view = viewConditions(params.view);
    conditions.push(...view.conditions);
    bindings.push(...view.bindings);

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return this.db.transaction(() => {
      const statsRow = this.db.sqlite
        .query(`
          SELECT
            COUNT(*) AS total,
            COALESCE(SUM(works.track_count), 0) AS trackCount,
            COALESCE(SUM(works.total_duration_sec), 0) AS durationSec
          ${WORKS_QUERY_FROM} ${whereSql}
        `)
        .get(...bindings) as { total: number; trackCount: number; durationSec: number };

      const orderBindings: number[] = [];
      const orderSql = worksOrderSql(params.sort, seed, orderBindings);
      const paginationSql =
        params.page !== undefined && params.limit !== undefined ? "LIMIT ? OFFSET ?" : "";
      const paginationBindings =
        params.page !== undefined && params.limit !== undefined
          ? [params.limit, (params.page - 1) * params.limit]
          : [];
      const rows = this.db.sqlite
        .query(`
        SELECT
          works.id,
          works.title,
          works.cover_image AS coverImage,
          works.cover_width AS coverWidth,
          works.cover_height AS coverHeight,
          works.status,
          works.total_duration_sec AS totalDurationSec,
          works.track_count AS trackCount,
          works.physical_path AS physicalPath,
          work_states.bookmarked,
          work_states.last_played_at AS lastPlayedAt,
          work_dlsite.state_json AS dlsiteStateJson
        ${WORKS_QUERY_FROM}
        LEFT JOIN main.work_dlsite AS work_dlsite ON work_dlsite.work_id = works.id
        ${whereSql}
        ORDER BY ${orderSql}
        ${paginationSql}
      `)
        .all(...bindings, ...orderBindings, ...paginationBindings) as RawWorkListRow[];
      const workIds = rows.map((row) => row.id);
      const circleNames = this.circleNameMap(workIds);
      const items = rows.map((row) => ({
        id: row.id,
        title: row.title,
        cover: coverFieldsFromColumns(row.coverImage, row.coverWidth, row.coverHeight).cover,
        status: row.status,
        totalDurationSec: row.totalDurationSec,
        trackCount: row.trackCount,
        bookmarked: row.bookmarked !== 0,
        lastPlayedAt: row.lastPlayedAt,
        circleName: circleNames.get(row.id) ?? null,
        folderName: folderNameFromPhysicalPath(row.physicalPath),
        dlsite: toWorkListItemDlsite(parseDlsiteStateJson(row.id, row.dlsiteStateJson)),
      }));
      const stats = { trackCount: statsRow.trackCount, durationSec: statsRow.durationSec };
      return seed === undefined
        ? { items, total: statsRow.total, stats }
        : { items, total: statsRow.total, stats, seed };
    });
  }

  getDlsiteNotificationSummary(): DlsiteNotificationSummary {
    const row = this.db.sqlite.query(DLSITE_NOTIFICATION_SUMMARY_SELECT).get() as {
      rjCodeMissingCount: number | null;
      fetchFailedCount: number | null;
      parseErrorCount: number | null;
      parseSuccessCount: number | null;
      unlinkedCount: number | null;
    };
    const parseErrorCount = row.parseErrorCount ?? 0;
    const parseSuccessCount = row.parseSuccessCount ?? 0;
    return {
      rjCodeMissingCount: row.rjCodeMissingCount ?? 0,
      fetchFailedCount: row.fetchFailedCount ?? 0,
      parseErrorCount,
      parseErrorAlert: evaluateParseErrorAlert(parseErrorCount, parseSuccessCount),
      unlinkedCount: row.unlinkedCount ?? 0,
    };
  }

  queryDlsiteNotifications(
    kind: DlsiteNotificationKind,
    query: Required<DlsiteNotificationQuery>,
  ): DlsiteNotificationPage {
    const condition = dlsiteNotificationWhere(kind);
    const rjCodeSelect =
      kind === "parse-failed"
        ? `json_extract(work_dlsite.state_json, '$.rjCode') AS rjCode`
        : `NULL AS rjCode`;
    const count = this.db.sqlite
      .query(
        `SELECT COUNT(*) AS total
         FROM main.works AS works
         LEFT JOIN main.work_dlsite AS work_dlsite ON work_dlsite.work_id = works.id
         WHERE ${condition}`,
      )
      .get() as { total: number };
    const rows = this.db.sqlite
      .query(
        `SELECT works.id AS id, works.title AS title,
                ${rjCodeSelect},
                COALESCE(json_extract(work_dlsite.state_json, '$.status'), 'none') AS status
         FROM main.works AS works
         LEFT JOIN main.work_dlsite AS work_dlsite ON work_dlsite.work_id = works.id
         WHERE ${condition}
         ORDER BY works.title_sort_key COLLATE BINARY ASC, works.id COLLATE BINARY ASC
         LIMIT ? OFFSET ?`,
      )
      .all(query.limit, (query.page - 1) * query.limit) as Array<{
      id: string;
      title: string;
      rjCode: string | null;
      status: "none" | "applied" | "not_found" | "error" | "skipped";
    }>;
    return { items: rows, total: count.total };
  }

  getScanWorkMap(): Map<string, ScanWorkState> {
    const rows = this.db.sqlite
      .query(
        `
          SELECT
            works.id AS id,
            works.source_revision AS sourceRevision,
            works.projection_revision AS projectionRevision,
            works.media_revision AS mediaRevision,
            works.status AS status,
            works.physical_path AS physicalPath,
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
          row.resumePlaylistId !== null &&
          row.resumeTrackId !== null &&
          row.resumeOffsetSec !== null
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

  fetchProbeCache(paths: string[]): Map<string, ProbeCacheEntry> {
    const map = new Map<string, ProbeCacheEntry>();
    const uniquePaths = [...new Set(paths)];
    if (uniquePaths.length === 0) return map;

    for (let i = 0; i < uniquePaths.length; i += SQLITE_IN_CHUNK_SIZE) {
      const pathChunk = uniquePaths.slice(i, i + SQLITE_IN_CHUNK_SIZE);
      const rows = this.db.sqlite
        .query(
          `SELECT path, size, mtime_ms AS mtimeMs, duration_sec AS durationSec FROM main.audio_probe_cache WHERE path IN (${inClausePlaceholders(pathChunk.length)})`,
        )
        .all(...pathChunk) as Array<{
        path: string;
        size: number;
        mtimeMs: number;
        durationSec: number | null;
      }>;
      for (const row of rows) {
        map.set(row.path, row);
      }
    }
    return map;
  }

  getAxisFacets(axis: string, filter: Partial<AxisFacetsQuery> = {}): AxisFacetItem[] {
    const { tags: realTags, yearValue } = filter.tags ?? { tags: [], yearValue: null };
    const tagAxis = tagAxisConditions(realTags, filter.tagOp ?? "AND", yearValue);
    const filterWhere =
      tagAxis.conditions.length > 0 ? `WHERE ${tagAxis.conditions.join(" AND ")}` : "";

    let rows: AxisFacetRow[];

    if (axis === "year") {
      rows = this.db.sqlite
        .query(
          axisFacetSql(`
            SELECT substr(work_states.added_at, 1, 4) AS value,
                   works.id AS work_id,
                   work_states.added_at AS added_at,
                   works.total_duration_sec AS duration_sec,
                   works.cover_image AS cover_image,
                   works.cover_width AS cover_width,
                   works.cover_height AS cover_height,
                   substr(work_states.added_at, 1, 4) AS sort_key
            FROM main.works
            INNER JOIN user.work_states AS work_states ON work_states.work_id = works.id
            ${filterWhere}
          `),
        )
        .all(...tagAxis.bindings) as AxisFacetRow[];
    } else if (axis === "tag") {
      rows = this.db.sqlite
        .query(
          axisFacetSql(`
            SELECT tags.name AS value,
                   works.id AS work_id,
                   work_states.added_at AS added_at,
                   works.total_duration_sec AS duration_sec,
                   works.cover_image AS cover_image,
                   works.cover_width AS cover_width,
                   works.cover_height AS cover_height,
                   tags.search_key AS sort_key
            FROM main.works
            INNER JOIN user.work_states AS work_states ON work_states.work_id = works.id
            INNER JOIN main.work_tags AS work_tags ON work_tags.work_id = works.id
            INNER JOIN main.tags AS tags ON tags.id = work_tags.tag_id
            ${filterWhere}
          `),
        )
        .all(...tagAxis.bindings) as AxisFacetRow[];
    } else {
      const prefixConditions = [
        "substr(tags.name, 1, instr(tags.name, '/') - 1) = ?",
        ...tagAxis.conditions,
      ];
      rows = this.db.sqlite
        .query(
          axisFacetSql(`
            SELECT substr(tags.name, instr(tags.name, '/') + 1) AS value,
                   works.id AS work_id,
                   work_states.added_at AS added_at,
                   works.total_duration_sec AS duration_sec,
                   works.cover_image AS cover_image,
                   works.cover_width AS cover_width,
                   works.cover_height AS cover_height,
                   tags.facet_sort_key AS sort_key
            FROM main.works
            INNER JOIN user.work_states AS work_states ON work_states.work_id = works.id
            INNER JOIN main.work_tags AS work_tags ON work_tags.work_id = works.id
            INNER JOIN main.tags AS tags ON tags.id = work_tags.tag_id
            WHERE ${prefixConditions.join(" AND ")}
          `),
        )
        .all(axis, ...tagAxis.bindings) as AxisFacetRow[];
    }

    return rows.map((row) => ({
      value: row.value,
      count: row.count,
      durationSec: row.durationSec,
      covers: JSON.parse(row.coversJson) as AxisFacetItem["covers"],
    }));
  }

  getCoverLocation(id: string): CoverLocationRow | null {
    return (
      (this.db.sqlite
        .query(
          `SELECT id, physical_path AS physicalPath, cover_image AS coverImage
           FROM main.works WHERE id = ?`,
        )
        .get(id) as CoverLocationRow | undefined) ?? null
    );
  }

  getMediaRoot(id: string): MediaRootRow | null {
    return (
      (this.db.sqlite
        .query(
          `SELECT physical_path AS physicalPath
           FROM main.works WHERE id = ?`,
        )
        .get(id) as MediaRootRow | undefined) ?? null
    );
  }

  getWorkByPhysicalPathSync(physicalPath: string): { id: string } | null {
    const row = this.db.catalog
      .select({ id: works.id })
      .from(works)
      .where(eq(works.physicalPath, physicalPath))
      .get();
    return row ?? null;
  }

  listAllTagNames(): string[] {
    return this.db.catalog
      .selectDistinct({ name: tags.name })
      .from(tags)
      .innerJoin(workTags, eq(workTags.tagId, tags.id))
      .orderBy(asc(tags.name))
      .all()
      .map((r) => r.name);
  }
}
