import { sep } from "node:path";
import { asc, eq } from "drizzle-orm";
import {
  createRandomSeed,
  relativeToRoot,
  isCoverUnmeasured,
  projectCoverKind,
  withNormalizeTagBatchCache,
  workPlacementOf,
} from "@mimimilli/shared";
import type {
  AxisFacetItem,
  Condition,
  GroupBy,
  MissingWork,
  SmartFolderRule,
  Work,
  WorkPlacement,
  WorkspacePath,
  WorksPage,
  WorksQuery,
} from "@mimimilli/shared";
import type { AxisFacetsQuery } from "@mimimilli/shared";
import { isPathWithin } from "../../lib/path.ts";
import type {
  ConditionGroupQuery,
  ConditionWorksQuery,
  EvalContext,
} from "../../adapter/condition.ts";
import { requireRandomSeed } from "../../core/conditionQuery.ts";
import { compileCondition } from "./conditionSql.ts";
import { japaneseSortKey } from "../../core/japaneseSortKey.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import { logDataIntegritySkips } from "./dataIntegrity.ts";
import type { Db } from "./db.ts";
import { tags, workDlsite, workTags, works } from "./catalogSchema.ts";
import {
  likeDescendantsPrefix,
  likeStrictDescendantPrefixSql,
  SQL_LIKE_ESCAPE_CLAUSE,
} from "./paths.ts";
import type { ProbeCacheEntry } from "./probe.ts";
import { fetchProbeCache as fetchProbeCacheFromDb } from "./probe.ts";
import { getScanWorkMap as getScanWorkMapFromDb } from "./scanWorkQueries.ts";
import {
  getCoverLocation as getCoverLocationFromDb,
  getWorkPlacement as getWorkPlacementFromDb,
  hasTrackFile as hasTrackFileFromDb,
} from "./workMediaQueries.ts";
import {
  axisFacetSql,
  chunk,
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
  type ListSummariesResult,
  mapRawWorkRows,
  parseDlsiteStateJson,
  type RawPlaylistRow,
  type RawSummaryListRow,
  type RawWorkListRow,
  type RawWorkRow,
  type SummaryRow,
  validateWorkRow,
  rowToWorkListItem,
  type WorkDetailParts,
  type WorkRow,
  PersistentDataError,
} from "./workRowMapping.ts";
import { statCoverSource } from "./coverDto.ts";
import { deriveCoverVersion } from "../../adapter/media.ts";

const queryWorksLogger = getCategoryLogger("http");

const WORK_LIST_ROW_SELECT = `
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
          works.meta_path AS metaPath,
          works.error_message AS errorMessage,
          works.urls_json AS urlsJson,
          work_states.added_at AS addedAt,
          work_states.bookmarked,
          work_states.last_played_at AS lastPlayedAt,
          work_dlsite.state_json AS dlsiteStateJson
        ${WORKS_QUERY_FROM}
        LEFT JOIN main.work_dlsite AS work_dlsite ON work_dlsite.work_id = works.id`;

function previousPathOf(root: string, physicalPath: string): WorkspacePath | null {
  return isPathWithin(root, physicalPath) ? relativeToRoot(physicalPath, root) : null;
}

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

  private loadSummaryRows(workIds: string[] | undefined): {
    rows: RawSummaryListRow[];
    tagsByWork: ReturnType<WorkQueryRepository["tagMap"]>;
  } {
    const baseSql = `
      SELECT
        works.id,
        works.title,
        works.cover_image AS coverImage,
        works.cover_width AS coverWidth,
        works.cover_height AS coverHeight,
        works.status,
        works.physical_path AS physicalPath,
        works.meta_path AS metaPath,
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
    return { rows, tagsByWork: this.tagMap(workIds) };
  }

  listSummaries(workIds?: string[]): ListSummariesResult {
    return withNormalizeTagBatchCache(() => {
      if (workIds !== undefined && workIds.length === 0) {
        return { summaries: [], skipped: [], unmeasuredCovers: [], placements: new Map() };
      }
      const { rows, tagsByWork } = this.loadSummaryRows(workIds);
      const summaries: ListSummariesResult["summaries"] = [];
      const skipped: ListSummariesResult["skipped"] = [];
      const unmeasuredCovers: string[] = [];
      const placements = new Map<string, WorkPlacement>();
      for (const rawRow of rows) {
        try {
          const row: SummaryRow = { ...rawRow, bookmarked: rawRow.bookmarked !== 0 };
          summaries.push(
            validateWorkRow(
              row,
              tagsByWork.get(row.id) ?? [],
              parseDlsiteStateJson(row.id, rawRow.dlsiteStateJson),
            ),
          );
          placements.set(row.id, workPlacementOf(row.metaPath));
          if (
            isCoverUnmeasured(
              projectCoverKind(rawRow.coverImage, rawRow.coverWidth, rawRow.coverHeight),
            )
          ) {
            unmeasuredCovers.push(rawRow.id);
          }
        } catch (error) {
          if (error instanceof PersistentDataError) {
            skipped.push({ workId: rawRow.id, reason: error.message });
            continue;
          }
          throw error;
        }
      }
      return { summaries, skipped, unmeasuredCovers, placements };
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

  /** ルールに一致しうる作品のサマリー。ルールなしは全作品（SQLで候補を絞るだけで最終評価は呼び出し側） */
  listSmartFolderCandidateSummaries(rules: SmartFolderRule[]): ListSummariesResult {
    if (rules.length === 0) return this.listSummaries();
    const { predicates, bindings } = smartFolderRulePredicates(rules);
    const rows = this.db.sqlite
      .query(`SELECT works.id AS id FROM main.works WHERE ${predicates.join(" OR ")}`)
      .all(...bindings) as Array<{ id: string }>;
    return this.listSummaries(rows.map((row) => row.id));
  }

  queryWorks(params: WorksQuery, root: string): WorksPage {
    const seed = params.sort === "random" ? (params.seed ?? createRandomSeed()) : undefined;
    const conditions: string[] = [];
    const bindings: Array<string | number> = [];

    if (params.ids !== undefined) {
      conditions.push("works.id IN (SELECT value FROM json_each(?))");
      bindings.push(JSON.stringify(params.ids));
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
    const page = this.runWorksQuery(
      { whereSql, bindings, sort: params.sort, seed, page: params.page, limit: params.limit },
      root,
    );
    return seed === undefined ? page : { ...page, seed };
  }

  /** 条件の木に一致する作品の一覧（ADR-0040）。seed は呼び出し側が渡し、ここでは発行しない */
  queryWorksByCondition(query: ConditionWorksQuery, root: string, ctx: EvalContext): WorksPage {
    const seed = requireRandomSeed(query.sort, query.seed);
    const compiled = compileCondition(query.condition, ctx);
    const conditions = [compiled.sql];
    const bindings: Array<string | number> = [...compiled.bindings];
    if (query.ids !== undefined) {
      conditions.push("works.id IN (SELECT value FROM json_each(?))");
      bindings.push(JSON.stringify(query.ids));
    }
    return this.runWorksQuery(
      {
        whereSql: `WHERE ${conditions.join(" AND ")}`,
        bindings,
        sort: query.sort,
        seed,
        page: query.page,
        limit: query.limit,
      },
      root,
    );
  }

  private runWorksQuery(
    run: {
      whereSql: string;
      bindings: Array<string | number>;
      sort: WorksQuery["sort"];
      seed: number | undefined;
      page: number | undefined;
      limit: number | undefined;
    },
    root: string,
  ): WorksPage {
    const { whereSql, bindings, sort, seed, page, limit } = run;
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
      const orderSql = worksOrderSql(sort, seed, orderBindings);
      const paginationSql = page !== undefined && limit !== undefined ? "LIMIT ? OFFSET ?" : "";
      const paginationBindings =
        page !== undefined && limit !== undefined ? [limit, (page - 1) * limit] : [];
      const rows = this.db.sqlite
        .query(`
        ${WORK_LIST_ROW_SELECT}
        ${whereSql}
        ORDER BY ${orderSql}
        ${paginationSql}
      `)
        .all(...bindings, ...orderBindings, ...paginationBindings) as RawWorkListRow[];
      const { items, skipped } = this.mapWorkListRows(rows, root);
      logDataIntegritySkips(queryWorksLogger, "query-works", skipped);
      const stats = { trackCount: statsRow.trackCount, durationSec: statsRow.durationSec };
      return { items, total: statsRow.total, stats };
    });
  }

  /** 一覧の行を作品に変換する。保存された値を読めない作品は skipped に分ける。行が読めるかの検証は validateWorkRow を通る */
  private mapWorkListRows(
    rows: RawWorkListRow[],
    root: string,
  ): { items: WorksPage["items"]; skipped: ListSummariesResult["skipped"] } {
    const tagsByWork = this.tagMap(rows.map((row) => row.id));
    const items: WorksPage["items"] = [];
    const skipped: ListSummariesResult["skipped"] = [];
    for (const row of rows) {
      try {
        items.push(
          rowToWorkListItem(
            row,
            tagsByWork.get(row.id) ?? [],
            parseDlsiteStateJson(row.id, row.dlsiteStateJson),
            root,
          ),
        );
      } catch (error) {
        if (error instanceof PersistentDataError) {
          skipped.push({ workId: row.id, reason: error.message });
          continue;
        }
        throw error;
      }
    }
    return { items, skipped };
  }

  /** 保存された値を読めず、作品一覧・スマートフォルダー・エクスポートから外れる作品。listSummaries と同じ検証で決まる */
  listDataIntegritySkips(workIds?: string[]): ListSummariesResult["skipped"] {
    return this.listSummaries(workIds).skipped;
  }

  /** 状態が missing の作品。ライブラリのエラー表示の「行方不明」と同じ集合 */
  listMissingWorks(root: string): MissingWork[] {
    const rows = this.db.sqlite
      .query(
        `SELECT works.id AS workId, works.title AS title, works.physical_path AS physicalPath
         ${WORKS_QUERY_FROM}
         WHERE works.status = 'missing'
         ORDER BY works.title, works.id`,
      )
      .all() as Array<{ workId: string; title: string; physicalPath: string }>;
    return rows.map((row) => ({
      workId: row.workId,
      title: row.title,
      previousPath: previousPathOf(root, row.physicalPath),
    }));
  }

  /** 保存値の検証を通さずに読む作品名と作品情報ファイルのパス。文字列でない値は null */
  getWorkIdentities(
    workIds: string[],
  ): Map<string, { title: string | null; metaPath: string | null }> {
    const identities = new Map<string, { title: string | null; metaPath: string | null }>();
    for (const idsChunk of chunk(workIds, SQLITE_IN_CHUNK_SIZE)) {
      const rows = this.db.sqlite
        .query(
          `SELECT id, title, meta_path AS metaPath FROM main.works WHERE id IN (${inClausePlaceholders(idsChunk.length)})`,
        )
        .all(...idsChunk) as Array<{ id: string; title: unknown; metaPath: unknown }>;
      for (const row of rows) {
        identities.set(row.id, {
          title: typeof row.title === "string" ? row.title : null,
          metaPath: typeof row.metaPath === "string" ? row.metaPath : null,
        });
      }
    }
    return identities;
  }

  /** DLsite連携のRJコードが一致する作品のID。投影更新の対象を引く */
  listWorkIdsByRjCode(productCode: string): string[] {
    const rows = this.db.sqlite
      .query(
        `SELECT work_id AS workId FROM main.work_dlsite
         WHERE upper(json_extract(state_json, '$.rjCode')) = ?`,
      )
      .all(productCode.trim().toUpperCase()) as Array<{ workId: string }>;
    return rows.map((row) => row.workId);
  }

  /** 行方不明（missing）でRJコードを持つ作品。候補に「同じRJコードの行方不明の作品」を付記するために引く */
  listMissingWorksWithRjCode(root: string): Array<MissingWork & { rjCode: string }> {
    const rows = this.db.sqlite
      .query(
        `SELECT upper(json_extract(work_dlsite.state_json, '$.rjCode')) AS rjCode,
                works.id AS workId, works.title AS title, works.physical_path AS physicalPath
         FROM main.works
         INNER JOIN main.work_dlsite AS work_dlsite ON work_dlsite.work_id = works.id
         WHERE works.status = 'missing'
           AND json_extract(work_dlsite.state_json, '$.rjCode') IS NOT NULL
           AND json_extract(work_dlsite.state_json, '$.rjCode') != ''
         ORDER BY works.title, works.id`,
      )
      .all() as Array<{ rjCode: string; workId: string; title: string; physicalPath: string }>;
    return rows.map(({ physicalPath, ...row }) => ({
      ...row,
      previousPath: previousPathOf(root, physicalPath),
    }));
  }

  getScanWorkMap() {
    return getScanWorkMapFromDb(this.db);
  }

  fetchProbeCache(paths: string[]): Map<string, ProbeCacheEntry> {
    return fetchProbeCacheFromDb(this.db, paths);
  }

  getAxisFacets(axis: string, filter: Partial<AxisFacetsQuery> = {}): AxisFacetItem[] {
    const { tags: realTags, yearValue } = filter.tags ?? { tags: [], yearValue: null };
    const tagAxis = tagAxisConditions(realTags, filter.tagOp ?? "AND", yearValue);
    const groupBy: GroupBy =
      axis === "year"
        ? { kind: "addedYear" }
        : axis === "tag"
          ? { kind: "tag" }
          : { kind: "prefix", prefix: axis };
    return this.facetItems(groupBy, tagAxis.conditions, tagAxis.bindings);
  }

  /** 条件の木に一致する作品を、グループ分けの値ごとに集計する（ADR-0040） */
  groupWorksByCondition(query: ConditionGroupQuery, ctx: EvalContext): AxisFacetItem[] {
    const compiled = compileCondition(query.condition, ctx);
    return this.facetItems(query.groupBy, [compiled.sql], compiled.bindings);
  }

  /** 条件ごとの一致件数を1回の走査で数える。入力と同じ順で返す */
  countByConditions(conditions: Condition[], ctx: EvalContext): number[] {
    if (conditions.length === 0) return [];
    const compiled = conditions.map((condition) => compileCondition(condition, ctx));
    const columns = compiled.map((c, index) => `COALESCE(SUM(${c.sql}), 0) AS c${index}`);
    const row = this.db.sqlite
      .query(`SELECT ${columns.join(", ")} ${WORKS_QUERY_FROM}`)
      .get(...compiled.flatMap((c) => c.bindings)) as Record<string, number>;
    return compiled.map((_, index) => row[`c${index}`]!);
  }

  private facetItems(
    groupBy: GroupBy,
    conditions: string[],
    bindings: Array<string | number>,
  ): AxisFacetItem[] {
    const filterWhere = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    let rows: AxisFacetRow[];

    if (groupBy.kind === "addedYear") {
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
        .all(...bindings) as AxisFacetRow[];
    } else if (groupBy.kind === "tag") {
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
        .all(...bindings) as AxisFacetRow[];
    } else {
      const prefixConditions = [
        "substr(tags.name, 1, instr(tags.name, '/') - 1) = ?",
        ...conditions,
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
        .all(groupBy.prefix, ...bindings) as AxisFacetRow[];
    }

    const versions = this.facetCoverVersions(
      rows.flatMap((row) =>
        (JSON.parse(row.coversJson) as Array<{ workId: string }>).map((cover) => cover.workId),
      ),
    );

    return rows.map((row) => ({
      value: row.value,
      count: row.count,
      durationSec: row.durationSec,
      covers: (
        JSON.parse(row.coversJson) as Array<Omit<AxisFacetItem["covers"][number], "version">>
      ).flatMap((cover) => {
        const version = versions.get(cover.workId);
        return version === undefined ? [] : [{ ...cover, version }];
      }),
    }));
  }

  private facetCoverVersions(workIds: string[]): Map<string, string> {
    const uniqueIds = [...new Set(workIds)];
    const versions = new Map<string, string>();
    if (uniqueIds.length === 0) return versions;

    for (let i = 0; i < uniqueIds.length; i += SQLITE_IN_CHUNK_SIZE) {
      const idsChunk = uniqueIds.slice(i, i + SQLITE_IN_CHUNK_SIZE);
      const locationRows = this.db.sqlite
        .query(
          `SELECT id, meta_path AS metaPath, cover_image AS coverImage
           FROM main.works WHERE id IN (${inClausePlaceholders(idsChunk.length)})`,
        )
        .all(...idsChunk) as Array<{ id: string; metaPath: string; coverImage: string }>;
      for (const row of locationRows) {
        const source = statCoverSource(workPlacementOf(row.metaPath), row.coverImage);
        if (source) {
          versions.set(row.id, deriveCoverVersion(row.id, undefined, source));
        }
      }
    }
    return versions;
  }

  getCoverLocation(id: string) {
    return getCoverLocationFromDb(this.db, id);
  }

  getWorkPlacement(id: string) {
    return getWorkPlacementFromDb(this.db, id);
  }

  hasTrackFile(workId: string, file: string): boolean {
    return hasTrackFileFromDb(this.db, workId, file);
  }

  getWorkByPhysicalPathSync(physicalPath: string): { id: string } | null {
    const row = this.db.catalog
      .select({ id: works.id })
      .from(works)
      .where(eq(works.physicalPath, physicalPath))
      .get();
    return row ?? null;
  }

  listWorkPhysicalPaths(): Set<string> {
    const rows = this.db.catalog.select({ physicalPath: works.physicalPath }).from(works).all();
    return new Set(rows.map((row) => row.physicalPath));
  }

  getWorkStatuses(ids: readonly string[]): Map<string, Work["status"]> {
    return new Map(
      chunk([...ids], SQLITE_IN_CHUNK_SIZE).flatMap((idsChunk) =>
        (
          this.db.sqlite
            .query(
              `SELECT id, status FROM main.works WHERE id IN (${inClausePlaceholders(idsChunk.length)})`,
            )
            .all(...idsChunk) as Array<{ id: string; status: Work["status"] }>
        ).map((row) => [row.id, row.status] as const),
      ),
    );
  }

  countWorksByStatus(status: Work["status"]): number {
    const row = this.db.sqlite
      .query(`SELECT COUNT(*) AS count ${WORKS_QUERY_FROM} WHERE works.status = ?`)
      .get(status) as { count: number };
    return row.count;
  }

  listWorkIdsByStatus(status: Work["status"]): string[] {
    return (
      this.db.sqlite
        .query(`SELECT works.id AS id ${WORKS_QUERY_FROM} WHERE works.status = ?`)
        .all(status) as Array<{
        id: string;
      }>
    ).map((row) => row.id);
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
