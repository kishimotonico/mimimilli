// works / tags / smart_folders / search_presets / app_settings の CRUD、検索、行⇄ドメイン変換。
import { asc, eq, inArray, notInArray } from "drizzle-orm";
import {
  dlsiteStateSchema,
  emptyDlsiteState,
  normalizeTag,
  normalizeTags,
  parseTag,
  playlistSchema,
  searchPresetSchema,
  smartFolderSchema,
  workSchema,
  workSummarySchema,
} from "@mimimilli/shared";
import type {
  AxisFacetItem,
  DlsiteState,
  Playlist,
  SearchPreset,
  SearchPresetCreate,
  SmartFolder,
  SmartFolderCreate,
  SmartFolderUpdate,
  TagPrefix,
  TagPrefixCreate,
  TagPrefixUpdate,
  Work,
  WorkSummary,
  UrlEntry,
  WorksPage,
  WorksQuery,
} from "@mimimilli/shared";
import { z } from "zod";
import { japaneseSortKey } from "../../core/japaneseSortKey.ts";
import type { Db } from "./db.ts";
import { tags, workDlsite, workTags, works, scanState } from "./catalogSchema.ts";
import { appSettings, searchPresets, smartFolders, tagPrefixes, workStates } from "./userSchema.ts";

type CatalogWorkRow = typeof works.$inferSelect;
type WorkRow = CatalogWorkRow & typeof workStates.$inferSelect;
type RawWorkRow = Omit<WorkRow, "bookmarked"> & { bookmarked: number };
type RawSummaryRow = RawWorkRow & { dlsiteStateJson: string | null };

const RECENT_VIEW_WINDOW_DAYS = 30;

export class PersistentDataError extends Error {
  constructor(table: string, recordId: string | number, detail: string) {
    super(`SQLite の ${table} レコード "${recordId}" が不正です: ${detail}`);
    this.name = "PersistentDataError";
  }
}

function parseJsonField(
  raw: string,
  table: string,
  recordId: string | number,
  field: string,
): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PersistentDataError(table, recordId, `${field}: JSON パースエラー: ${message}`);
  }
}

function parseRecord<T>(
  schema: z.ZodType<T>,
  value: unknown,
  table: string,
  recordId: string | number,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const detail = result.error.issues
    .map((issue) => `${issue.path.join(".") || "(record)"}: ${issue.message}`)
    .join("; ");
  throw new PersistentDataError(table, recordId, detail);
}

function defaultPlaylistOf(
  row: Pick<CatalogWorkRow, "id" | "defaultPlaylist">,
  playlists: Playlist[],
): Playlist | null {
  if (playlists.length === 0) return null;
  if (row.defaultPlaylist) {
    const playlist = playlists.find((p) => p.name === row.defaultPlaylist);
    if (!playlist) {
      throw new PersistentDataError(
        "works",
        row.id,
        `defaultPlaylist: playlists_json に "${row.defaultPlaylist}" がありません`,
      );
    }
    return playlist;
  }
  return playlists[0]!;
}

function rowToSummary(row: WorkRow, tagNames: string[], dlsite: DlsiteState): WorkSummary {
  const playlists = parseRecord(
    z.array(playlistSchema),
    parseJsonField(row.playlistsJson, "works", row.id, "playlists_json"),
    "works",
    row.id,
  );
  return parseRecord(
    workSummarySchema,
    {
      id: row.id,
      title: row.title,
      coverImage: row.coverImage,
      status: row.status,
      physicalPath: row.physicalPath,
      totalDurationSec: row.totalDurationSec,
      addedAt: row.addedAt,
      errorMessage: row.errorMessage,
      urls: parseJsonField(row.urlsJson, "works", row.id, "urls_json"),
      tags: tagNames,
      trackCount: defaultPlaylistOf(row, playlists)?.tracks.length ?? 0,
      bookmarked: row.bookmarked,
      lastPlayedAt: row.lastPlayedAt,
      dlsite,
    },
    "works",
    row.id,
  );
}

function rowToWork(row: WorkRow, tagNames: string[], dlsite: DlsiteState): Work {
  return parseRecord(
    workSchema,
    {
      id: row.id,
      title: row.title,
      coverImage: row.coverImage,
      status: row.status,
      physicalPath: row.physicalPath,
      totalDurationSec: row.totalDurationSec,
      addedAt: row.addedAt,
      errorMessage: row.errorMessage,
      urls: parseJsonField(row.urlsJson, "works", row.id, "urls_json"),
      tags: tagNames,
      defaultPlaylist: row.defaultPlaylist,
      createdAt: row.createdAt,
      playlists: parseJsonField(row.playlistsJson, "works", row.id, "playlists_json"),
      bookmarked: row.bookmarked,
      lastPlayedAt: row.lastPlayedAt,
      resumePosition: row.resumePosition,
      resumeTrackIndex: row.resumeTrackIndex,
      dlsite,
    },
    "works",
    row.id,
  );
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! & 0x7fffffff;
}

function worksOrderSql(
  sort: WorksQuery["sort"],
  seed: number | undefined,
  bindings: number[],
): string {
  const idTieBreaker = "works.id COLLATE BINARY ASC";
  switch (sort) {
    case "title-asc":
      return `works.title_sort_key COLLATE BINARY ASC, ${idTieBreaker}`;
    case "title-desc":
      return `works.title_sort_key COLLATE BINARY DESC, ${idTieBreaker}`;
    case "added-asc":
      return `work_states.added_at ASC, ${idTieBreaker}`;
    case "added-desc":
      return `work_states.added_at DESC, ${idTieBreaker}`;
    case "duration-asc":
      return `works.total_duration_sec ASC, ${idTieBreaker}`;
    case "duration-desc":
      return `works.total_duration_sec DESC, ${idTieBreaker}`;
    case "last-played":
      return `work_states.last_played_at IS NULL ASC, work_states.last_played_at DESC, ${idTieBreaker}`;
    case "id-asc":
      return idTieBreaker;
    case "random": {
      if (seed === undefined) throw new Error("randomソートにはseedが必要です");
      bindings.push(seed, seed);
      const hexId = "hex(works.id)";
      const rotated =
        `CASE WHEN length(${hexId}) = 0 THEN '' ELSE ` +
        `substr(${hexId}, (? % length(${hexId})) + 1) || ` +
        `substr(${hexId}, 1, ? % length(${hexId})) END`;
      return `${rotated} COLLATE BINARY ASC, ${idTieBreaker}`;
    }
  }
}

export class WorkRepo {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  // ── タグ ──────────────────────────────────────────────────

  /** workId → タグ名一覧のマップを作る（対象未指定なら全件） */
  private tagMap(workIds?: string[]): Map<string, string[]> {
    const rows =
      workIds === undefined
        ? this.db.catalog
            .select({ workId: workTags.workId, name: tags.name })
            .from(workTags)
            .innerJoin(tags, eq(workTags.tagId, tags.id))
            .all()
        : workIds.length === 0
          ? []
          : this.db.catalog
              .select({ workId: workTags.workId, name: tags.name })
              .from(workTags)
              .innerJoin(tags, eq(workTags.tagId, tags.id))
              .where(inArray(workTags.workId, workIds))
              .all();
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const list = map.get(r.workId);
      if (list) list.push(r.name);
      else map.set(r.workId, [r.name]);
    }
    return map;
  }

  private replaceWorkTags(workId: string, tagNames: string[]): void {
    this.db.catalog.delete(workTags).where(eq(workTags.workId, workId)).run();
    // DB キャッシュには常に正規形で入れる（ADR-0005 決定5）。メタファイル側の正規化は
    // 編集経路（PATCH / DLsite 適用）で行い、スキャン取り込みはメタを書き換えない
    for (const name of normalizeTags(tagNames)) {
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

  listAllTagNames(): string[] {
    // 作品に紐づいているタグのみ（孤児タグは出さない）
    return this.db.catalog
      .selectDistinct({ name: tags.name })
      .from(tags)
      .innerJoin(workTags, eq(workTags.tagId, tags.id))
      .orderBy(asc(tags.name))
      .all()
      .map((r) => r.name);
  }

  // ── works ─────────────────────────────────────────────────

  private dlsiteState(workId: string): DlsiteState {
    const row = this.db.catalog
      .select()
      .from(workDlsite)
      .where(eq(workDlsite.workId, workId))
      .get();
    if (!row) return emptyDlsiteState();
    return parseRecord(
      dlsiteStateSchema,
      parseJsonField(row.stateJson, "work_dlsite", workId, "state_json"),
      "work_dlsite",
      workId,
    );
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

  private joinedWorks(whereSql = "", parameter?: string): WorkRow[] {
    const sql = `
      SELECT
        works.id,
        works.title,
        works.title_sort_key AS titleSortKey,
        works.cover_image AS coverImage,
        works.default_playlist AS defaultPlaylist,
        works.created_at AS createdAt,
        works.status,
        works.physical_path AS physicalPath,
        works.total_duration_sec AS totalDurationSec,
        works.error_message AS errorMessage,
        works.urls_json AS urlsJson,
        works.playlists_json AS playlistsJson,
        work_states.work_id AS workId,
        work_states.added_at AS addedAt,
        work_states.bookmarked,
        work_states.last_played_at AS lastPlayedAt,
        work_states.resume_position AS resumePosition,
        work_states.resume_track_index AS resumeTrackIndex
      FROM main.works
      INNER JOIN user.work_states ON work_states.work_id = works.id
      ${whereSql}
    `;
    const rows =
      parameter !== undefined
        ? this.db.sqlite.query(sql).all(parameter)
        : this.db.sqlite.query(sql).all();
    return (rows as RawWorkRow[]).map((row) => ({
      ...row,
      bookmarked: row.bookmarked !== 0,
    }));
  }

  listSummaries(): WorkSummary[] {
    const rows = this.joinedWorks();
    const tagsByWork = this.tagMap();
    return rows.map((row) =>
      rowToSummary(row, tagsByWork.get(row.id) ?? [], this.dlsiteState(row.id)),
    );
  }

  /** ADR-0008: ATTACH JOINした同じ絞り込み集合から件数とページを求める。 */
  queryWorks(params: WorksQuery): WorksPage {
    const seed = params.sort === "random" ? (params.seed ?? randomSeed()) : undefined;
    const conditions: string[] = [];
    const bindings: Array<string | number> = [];

    if (params.q) {
      const key = japaneseSortKey(params.q);
      conditions.push(`(
        instr(works.title_sort_key, ?) > 0 OR EXISTS (
          SELECT 1
          FROM main.work_tags AS query_work_tags
          INNER JOIN main.tags AS query_tags ON query_tags.id = query_work_tags.tag_id
          WHERE query_work_tags.work_id = works.id
            AND instr(query_tags.search_key, ?) > 0
        )
      )`);
      bindings.push(key, key);
    }

    const normalizedTags = params.tags.map(normalizeTag);
    if (normalizedTags.length > 0) {
      if (params.tagOp === "AND") {
        for (const tag of normalizedTags) {
          conditions.push(`EXISTS (
            SELECT 1
            FROM main.work_tags AS filter_work_tags
            INNER JOIN main.tags AS filter_tags ON filter_tags.id = filter_work_tags.tag_id
            WHERE filter_work_tags.work_id = works.id AND filter_tags.name = ?
          )`);
          bindings.push(tag);
        }
      } else {
        const placeholders = normalizedTags.map(() => "?").join(", ");
        conditions.push(`EXISTS (
          SELECT 1
          FROM main.work_tags AS filter_work_tags
          INNER JOIN main.tags AS filter_tags ON filter_tags.id = filter_work_tags.tag_id
          WHERE filter_work_tags.work_id = works.id
            AND filter_tags.name IN (${placeholders})
        )`);
        bindings.push(...normalizedTags);
      }
    }

    if (params.axis && params.axisValue) {
      if (params.axis === "year") {
        conditions.push("substr(work_states.added_at, 1, 4) = ?");
        bindings.push(params.axisValue);
      } else {
        conditions.push(`EXISTS (
          SELECT 1
          FROM main.work_tags AS axis_work_tags
          INNER JOIN main.tags AS axis_tags ON axis_tags.id = axis_work_tags.tag_id
          WHERE axis_work_tags.work_id = works.id AND axis_tags.name = ?
        )`);
        bindings.push(`${params.axis}/${params.axisValue}`);
      }
    }

    switch (params.view) {
      case "recent":
        conditions.push("work_states.last_played_at IS NOT NULL");
        break;
      case "added":
        conditions.push("work_states.added_at >= ?");
        bindings.push(new Date(Date.now() - RECENT_VIEW_WINDOW_DAYS * 86400000).toISOString());
        break;
      case "fav":
        conditions.push("work_states.bookmarked = 1");
        break;
      case "unplayed":
        conditions.push("work_states.last_played_at IS NULL AND works.status = 'ok'");
        break;
      case "missing":
        conditions.push("works.status = 'missing'");
        break;
    }

    const fromSql = `
      FROM main.works
      INNER JOIN user.work_states AS work_states ON work_states.work_id = works.id
    `;
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return this.db.transaction(() => {
      const countRow = this.db.sqlite
        .query(`SELECT COUNT(*) AS total ${fromSql} ${whereSql}`)
        .get(...bindings) as { total: number };

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
          works.title_sort_key AS titleSortKey,
          works.cover_image AS coverImage,
          works.default_playlist AS defaultPlaylist,
          works.created_at AS createdAt,
          works.status,
          works.physical_path AS physicalPath,
          works.total_duration_sec AS totalDurationSec,
          works.error_message AS errorMessage,
          works.urls_json AS urlsJson,
          works.playlists_json AS playlistsJson,
          work_states.work_id AS workId,
          work_states.added_at AS addedAt,
          work_states.bookmarked,
          work_states.last_played_at AS lastPlayedAt,
          work_states.resume_position AS resumePosition,
          work_states.resume_track_index AS resumeTrackIndex,
          work_dlsite.state_json AS dlsiteStateJson
        ${fromSql}
        LEFT JOIN main.work_dlsite AS work_dlsite ON work_dlsite.work_id = works.id
        ${whereSql}
        ORDER BY ${orderSql}
        ${paginationSql}
      `)
        .all(...bindings, ...orderBindings, ...paginationBindings) as RawSummaryRow[];
      const workIds = rows.map((row) => row.id);
      const tagsByWork = this.tagMap(workIds);
      const items = rows.map((rawRow) => {
        const row: WorkRow = { ...rawRow, bookmarked: rawRow.bookmarked !== 0 };
        const dlsite = rawRow.dlsiteStateJson
          ? parseRecord(
              dlsiteStateSchema,
              parseJsonField(rawRow.dlsiteStateJson, "work_dlsite", rawRow.id, "state_json"),
              "work_dlsite",
              rawRow.id,
            )
          : emptyDlsiteState();
        return rowToSummary(row, tagsByWork.get(row.id) ?? [], dlsite);
      });
      return seed === undefined
        ? { items, total: countRow.total }
        : { items, total: countRow.total, seed };
    });
  }

  /** 作品全件のロードをせず、SQLのGROUP BYで軸ファセットを集計する。 */
  getAxisFacets(axis: string): AxisFacetItem[] {
    if (axis === "year") {
      return this.db.sqlite
        .query(`
          SELECT substr(work_states.added_at, 1, 4) AS value, COUNT(*) AS count
          FROM main.works
          INNER JOIN user.work_states AS work_states ON work_states.work_id = works.id
          GROUP BY value
          ORDER BY count DESC, value COLLATE BINARY ASC
        `)
        .all() as AxisFacetItem[];
    }

    const prefixCondition =
      axis === "tag"
        ? "instr(tags.name, '/') = 0"
        : "substr(tags.name, 1, instr(tags.name, '/') - 1) = ?";
    const valueSql = axis === "tag" ? "tags.name" : "substr(tags.name, instr(tags.name, '/') + 1)";
    return this.db.sqlite
      .query(`
        SELECT ${valueSql} AS value, COUNT(*) AS count
        FROM main.works
        INNER JOIN user.work_states AS work_states ON work_states.work_id = works.id
        INNER JOIN main.work_tags AS work_tags ON work_tags.work_id = works.id
        INNER JOIN main.tags AS tags ON tags.id = work_tags.tag_id
        WHERE ${prefixCondition}
        GROUP BY value
        ORDER BY count DESC, tags.facet_sort_key COLLATE BINARY ASC, value COLLATE BINARY ASC
      `)
      .all(...(axis === "tag" ? [] : [axis])) as AxisFacetItem[];
  }

  getWork(id: string): Work | null {
    const row = this.joinedWorks("WHERE works.id = ?", id)[0];
    if (!row) return null;
    return rowToWork(row, this.tagMap([id]).get(id) ?? [], this.dlsiteState(id));
  }

  getWorkByPhysicalPath(physicalPath: string): Work | null {
    const row = this.joinedWorks("WHERE works.physical_path = ?", physicalPath)[0];
    if (!row) return null;
    return rowToWork(row, this.tagMap([row.id]).get(row.id) ?? [], this.dlsiteState(row.id));
  }

  /** scan からの登録。タグも置き換える */
  upsertWork(work: Work): void {
    // 2DBをまたぐ原子性には依存せず、user状態を先に冪等作成してからcatalogを書く。
    this.db.user
      .insert(workStates)
      .values({
        workId: work.id,
        addedAt: work.addedAt,
        bookmarked: work.bookmarked,
        lastPlayedAt: work.lastPlayedAt,
        resumePosition: work.resumePosition,
        resumeTrackIndex: work.resumeTrackIndex,
      })
      .onConflictDoNothing()
      .run();
    const values = {
      id: work.id,
      title: work.title,
      titleSortKey: japaneseSortKey(work.title),
      coverImage: work.coverImage,
      defaultPlaylist: work.defaultPlaylist,
      createdAt: work.createdAt,
      status: work.status,
      physicalPath: work.physicalPath,
      totalDurationSec: work.totalDurationSec,
      errorMessage: work.errorMessage,
      urlsJson: JSON.stringify(work.urls),
      playlistsJson: JSON.stringify(work.playlists),
    };
    this.db.catalog
      .insert(works)
      .values(values)
      .onConflictDoUpdate({ target: works.id, set: values })
      .run();
    this.replaceWorkTags(work.id, work.tags);
    this.setDlsiteState(work.id, work.dlsite);
  }

  /** PATCH /works/:id および DLsite 適用の DB 側。メタファイル書き戻しは呼び出し側（アダプタ）が行う */
  patchWork(
    id: string,
    patch: {
      title?: string;
      tags?: string[];
      bookmarked?: boolean;
      coverImage?: string;
      urls?: UrlEntry[];
    },
  ): Work | null {
    const row = this.db.catalog.select().from(works).where(eq(works.id, id)).get();
    if (!row) return null;
    const set: Partial<typeof works.$inferInsert> = {};
    if (patch.title !== undefined) {
      set.title = patch.title;
      set.titleSortKey = japaneseSortKey(patch.title);
    }
    if (patch.coverImage !== undefined) set.coverImage = patch.coverImage;
    if (patch.urls !== undefined) set.urlsJson = JSON.stringify(patch.urls);
    if (Object.keys(set).length > 0) {
      this.db.catalog.update(works).set(set).where(eq(works.id, id)).run();
    }
    if (patch.bookmarked !== undefined) {
      this.db.user
        .update(workStates)
        .set({ bookmarked: patch.bookmarked })
        .where(eq(workStates.workId, id))
        .run();
    }
    if (patch.tags !== undefined) {
      this.replaceWorkTags(id, patch.tags);
    }
    return this.getWork(id);
  }

  saveResume(id: string, position: number, trackIndex: number): boolean {
    if (!this.db.catalog.select({ id: works.id }).from(works).where(eq(works.id, id)).get()) {
      return false;
    }
    const r = this.db.user
      .update(workStates)
      .set({ resumePosition: position, resumeTrackIndex: trackIndex })
      .where(eq(workStates.workId, id))
      .returning({ id: workStates.workId })
      .get();
    return r !== undefined;
  }

  touchLastPlayed(id: string): boolean {
    if (!this.db.catalog.select({ id: works.id }).from(works).where(eq(works.id, id)).get()) {
      return false;
    }
    const r = this.db.user
      .update(workStates)
      .set({ lastPlayedAt: new Date().toISOString() })
      .where(eq(workStates.workId, id))
      .returning({ id: workStates.workId })
      .get();
    return r !== undefined;
  }

  markWorkError(id: string, physicalPath: string, errorMessage: string): boolean {
    return (
      this.db.catalog
        .update(works)
        .set({ status: "error", physicalPath, errorMessage })
        .where(eq(works.id, id))
        .returning({ id: works.id })
        .get() !== undefined
    );
  }

  markMissingExcept(foundIds: string[]): void {
    const set = { status: "missing", errorMessage: null } as const;
    if (foundIds.length === 0) {
      this.db.catalog.update(works).set(set).run();
      return;
    }
    this.db.catalog.update(works).set(set).where(notInArray(works.id, foundIds)).run();
  }

  countByStatus(status: string): number {
    return this.db.catalog
      .select({ id: works.id })
      .from(works)
      .where(eq(works.status, status))
      .all().length;
  }

  // ── タグ prefix 定義（ADR-0005）───────────────────────────

  listTagPrefixes(): TagPrefix[] {
    return this.db.user
      .select()
      .from(tagPrefixes)
      .orderBy(asc(tagPrefixes.id))
      .all()
      .map((r) => ({
        prefix: r.prefix,
        label: r.label,
        color: r.color,
        showAsAxis: r.showAsAxis,
        protected: r.protected,
      }));
  }

  getTagPrefix(prefix: string): TagPrefix | null {
    const r = this.db.user.select().from(tagPrefixes).where(eq(tagPrefixes.prefix, prefix)).get();
    if (!r) return null;
    return {
      prefix: r.prefix,
      label: r.label,
      color: r.color,
      showAsAxis: r.showAsAxis,
      protected: r.protected,
    };
  }

  /** 既に存在する prefix なら null（呼び出し側で 409 にする） */
  createTagPrefix(input: TagPrefixCreate): TagPrefix | null {
    const r = this.db.user
      .insert(tagPrefixes)
      .values({
        prefix: input.prefix,
        label: input.label,
        color: input.color,
        showAsAxis: input.showAsAxis,
        protected: input.protected,
      })
      .onConflictDoNothing()
      .returning({ id: tagPrefixes.id })
      .get();
    if (!r) return null;
    return this.getTagPrefix(input.prefix);
  }

  updateTagPrefix(prefix: string, patch: TagPrefixUpdate): TagPrefix | null {
    const existing = this.getTagPrefix(prefix);
    if (!existing) return null;
    const set: Partial<typeof tagPrefixes.$inferInsert> = {};
    if (patch.label !== undefined) set.label = patch.label;
    if (patch.color !== undefined) set.color = patch.color;
    if (patch.showAsAxis !== undefined) set.showAsAxis = patch.showAsAxis;
    if (patch.protected !== undefined) set.protected = patch.protected;
    if (Object.keys(set).length > 0) {
      this.db.user.update(tagPrefixes).set(set).where(eq(tagPrefixes.prefix, prefix)).run();
    }
    return this.getTagPrefix(prefix);
  }

  deleteTagPrefix(prefix: string): boolean {
    return (
      this.db.user
        .delete(tagPrefixes)
        .where(eq(tagPrefixes.prefix, prefix))
        .returning({ id: tagPrefixes.id })
        .get() !== undefined
    );
  }

  // ── app_settings（KVストア）──────────────────────────────

  getUserSetting(key: string): string | null {
    const row = this.db.user.select().from(appSettings).where(eq(appSettings.key, key)).get();
    return row?.value ?? null;
  }

  setUserSetting(key: string, value: string | null): void {
    this.db.user
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } })
      .run();
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

  // ── スマートフォルダー ─────────────────────────────────────

  listSmartFolders(): SmartFolder[] {
    return this.db.user
      .select()
      .from(smartFolders)
      .orderBy(asc(smartFolders.createdAt))
      .all()
      .map((r) =>
        parseRecord(
          smartFolderSchema,
          {
            id: r.id,
            name: r.name,
            rules: parseJsonField(r.rulesJson, "smart_folders", r.id, "rules_json"),
            sort: r.sort,
            createdAt: r.createdAt,
          },
          "smart_folders",
          r.id,
        ),
      );
  }

  getSmartFolder(id: string): SmartFolder | null {
    const r = this.db.user.select().from(smartFolders).where(eq(smartFolders.id, id)).get();
    if (!r) return null;
    return parseRecord(
      smartFolderSchema,
      {
        id: r.id,
        name: r.name,
        rules: parseJsonField(r.rulesJson, "smart_folders", r.id, "rules_json"),
        sort: r.sort,
        createdAt: r.createdAt,
      },
      "smart_folders",
      r.id,
    );
  }

  createSmartFolder(input: SmartFolderCreate): SmartFolder {
    const folder: SmartFolder = {
      id: `sf-${crypto.randomUUID()}`,
      name: input.name,
      rules: input.rules,
      sort: input.sort,
      createdAt: new Date().toISOString(),
    };
    this.db.user
      .insert(smartFolders)
      .values({
        id: folder.id,
        name: folder.name,
        rulesJson: JSON.stringify(folder.rules),
        sort: folder.sort,
        createdAt: folder.createdAt,
      })
      .run();
    return folder;
  }

  updateSmartFolder(id: string, input: SmartFolderUpdate): SmartFolder | null {
    const existing = this.getSmartFolder(id);
    if (!existing) return null;
    const set: Partial<typeof smartFolders.$inferInsert> = {};
    if (input.name !== undefined) set.name = input.name;
    if (input.rules !== undefined) set.rulesJson = JSON.stringify(input.rules);
    if (input.sort !== undefined) set.sort = input.sort;
    if (Object.keys(set).length > 0) {
      this.db.user.update(smartFolders).set(set).where(eq(smartFolders.id, id)).run();
    }
    return this.getSmartFolder(id);
  }

  deleteSmartFolder(id: string): boolean {
    return (
      this.db.user
        .delete(smartFolders)
        .where(eq(smartFolders.id, id))
        .returning({ id: smartFolders.id })
        .get() !== undefined
    );
  }

  // ── 検索プリセット ─────────────────────────────────────────

  listPresets(): SearchPreset[] {
    return this.db.user
      .select()
      .from(searchPresets)
      .orderBy(asc(searchPresets.id))
      .all()
      .map((r) =>
        parseRecord(
          searchPresetSchema,
          {
            id: r.id,
            name: r.name,
            query: r.query,
            tagFilters: parseJsonField(
              r.tagFiltersJson,
              "search_presets",
              r.id,
              "tag_filters_json",
            ),
            sortId: r.sortId,
          },
          "search_presets",
          r.id,
        ),
      );
  }

  createPreset(input: SearchPresetCreate): SearchPreset {
    const r = this.db.user
      .insert(searchPresets)
      .values({
        name: input.name,
        query: input.query,
        tagFiltersJson: JSON.stringify(input.tagFilters),
        sortId: input.sortId,
      })
      .returning({ id: searchPresets.id })
      .get();
    if (!r) throw new Error("検索プリセットを保存できませんでした");
    return {
      id: r.id,
      name: input.name,
      query: input.query,
      tagFilters: input.tagFilters,
      sortId: input.sortId,
    };
  }

  deletePreset(id: number): boolean {
    return (
      this.db.user
        .delete(searchPresets)
        .where(eq(searchPresets.id, id))
        .returning({ id: searchPresets.id })
        .get() !== undefined
    );
  }
}
