// works / tags / smart_folders / search_presets / app_settings の CRUD、検索、行⇄ドメイン変換。
import { join } from "node:path";
import { asc, eq } from "drizzle-orm";
import {
  dlsiteStateSchema,
  emptyDlsiteState,
  normalizeTag,
  normalizeTags,
  parseTag,
  playlistSchema,
  resolveTrackDurationSec,
  searchPresetSchema,
  smartFolderSchema,
  workSchema,
  workSummarySchema,
} from "@mimimilli/shared";
import type {
  AxisFacetItem,
  Cover,
  DlsiteState,
  DlsiteNotificationPage,
  DlsiteNotificationQuery,
  DlsiteNotificationSummary,
  Playlist,
  ResolvedPlaylist,
  ResumeBody,
  SearchPreset,
  SearchPresetCreate,
  SmartFolder,
  SmartFolderCreate,
  SmartFolderRule,
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
import { InvalidResumeError } from "../../adapter.ts";
import type { Db } from "./db.ts";
import {
  audioProbeCache,
  playlists as catalogPlaylists,
  scanState,
  tags,
  tracks as catalogTracks,
  workDlsite,
  workTags,
  works,
} from "./catalogSchema.ts";
import { appSettings, searchPresets, smartFolders, tagPrefixes, workStates } from "./userSchema.ts";

type CatalogWorkRow = typeof works.$inferSelect;
type WorkRow = CatalogWorkRow & typeof workStates.$inferSelect & { resumeResolved: boolean };
type RawWorkRow = Omit<WorkRow, "bookmarked" | "resumeResolved"> & {
  bookmarked: number;
  resumeResolved: number;
};
/** rowToSummary が参照する列。listSummaries の軽量クエリはこの列集合だけを取得する（TASK-57） */
type SummaryRow = Pick<
  WorkRow,
  | "id"
  | "title"
  | "coverImage"
  | "coverWidth"
  | "coverHeight"
  | "status"
  | "physicalPath"
  | "totalDurationSec"
  | "addedAt"
  | "errorMessage"
  | "urlsJson"
  | "trackCount"
  | "bookmarked"
  | "lastPlayedAt"
>;
type RawSummaryListRow = Omit<SummaryRow, "bookmarked"> & {
  bookmarked: number;
  dlsiteStateJson: string | null;
};
/** GET /works の公開DTOを作るためだけの軽量な行。JSON列や物理パスは含めない。 */
type RawWorkListRow = {
  id: string;
  title: string;
  coverImage: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  status: WorkSummary["status"];
  totalDurationSec: number;
  trackCount: number;
  bookmarked: number;
  lastPlayedAt: string | null;
};

/**
 * scanner が変更作品の登録時に引き継ぐ user 所有の状態。
 * resume は関係表で解決せず生の値を保持する。スキャン中に作品ごとのgetWorkを呼ぶと
 * end未指定トラックのresume解決がprobe cacheへの個別SELECTを発生させるためである。
 */
export interface ScanWorkState {
  fingerprint: string | null;
  physicalPath: string;
  addedAt: string;
  bookmarked: boolean;
  lastPlayedAt: string | null;
  resume: Work["resume"];
  /** DBに記録済みのカバー状態。スキャンのカバー再計測要否の判定に使う。 */
  cover: CoverColumns;
}

/**
 * DBのカバー3列（cover_image / cover_width / cover_height）の生表現。
 * image は .meta.json 由来のファイル名、dimensions は計測成功時のみ。
 * image あり・dimensions null は「カバーはあるが寸法を計測できていない」状態を表す。
 */
export interface CoverColumns {
  image: string | null;
  dimensions: { width: number; height: number } | null;
}

/** DBのカバー列を公開DTOの cover へ投影する。画像かつ両寸法が揃うときだけ表示可能とみなす。 */
function projectCover(image: string | null, width: number | null, height: number | null): Cover {
  if (image === null || width === null || height === null) return null;
  return { image, dimensions: { width, height } };
}

/** ドメインの cover から書き込み列を導く。upsertWork に明示指定が無いときの既定。 */
function coverColumnsFromCover(cover: Cover): CoverColumns {
  return cover === null
    ? { image: null, dimensions: null }
    : { image: cover.image, dimensions: cover.dimensions };
}

/** カバー配信の事前確認に必要な列だけを取得する軽量行。 */
export interface CoverLocationRow {
  id: string;
  physicalPath: string;
  coverImage: string | null;
}

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

function defaultPlaylistOf<P extends { id: string; tracks: unknown[] }>(
  row: Pick<CatalogWorkRow, "id" | "defaultPlaylistId">,
  playlists: P[],
): P | null {
  if (playlists.length === 0) return null;
  if (row.defaultPlaylistId) {
    const playlist = playlists.find((p) => p.id === row.defaultPlaylistId);
    if (!playlist) {
      throw new PersistentDataError(
        "works",
        row.id,
        `defaultPlaylistId: playlists_json に "${row.defaultPlaylistId}" がありません`,
      );
    }
    return playlist;
  }
  return playlists[0]!;
}

function rowToSummary(row: SummaryRow, tagNames: string[], dlsite: DlsiteState): WorkSummary {
  // trackCount は works.track_count 列を使う（playlists_json の全件パースを避ける。TASK-57）
  return parseRecord(
    workSummarySchema,
    {
      id: row.id,
      title: row.title,
      cover: projectCover(row.coverImage, row.coverWidth, row.coverHeight),
      status: row.status,
      physicalPath: row.physicalPath,
      totalDurationSec: row.totalDurationSec,
      addedAt: row.addedAt,
      errorMessage: row.errorMessage,
      urls: parseJsonField(row.urlsJson, "works", row.id, "urls_json"),
      tags: tagNames,
      trackCount: row.trackCount,
      bookmarked: row.bookmarked,
      lastPlayedAt: row.lastPlayedAt,
      dlsite,
    },
    "works",
    row.id,
  );
}

function parseWorkPlaylists(row: Pick<WorkRow, "id" | "playlistsJson">): Playlist[] {
  return parseRecord(
    z.array(playlistSchema),
    parseJsonField(row.playlistsJson, "works", row.id, "playlists_json"),
    "works",
    row.id,
  );
}

function rowToWork(
  row: WorkRow,
  rawPlaylists: Playlist[],
  tagNames: string[],
  dlsite: DlsiteState,
  liveFileDurations: Map<string, number | null>,
): Work {
  // end指定済みトラックは自明値（end-start）で合成する。
  // end未指定トラックはファイル置換をrescan無しで検知できるよう、audio_probe_cacheの
  // 現在値を作品内全ファイルパス一括取得（liveFileDurations）で都度解決する。
  // playlists_json（正本）には派生値を書かない。
  const playlists: ResolvedPlaylist[] = rawPlaylists.map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    tracks: playlist.tracks.map((track) => {
      const durationSec =
        track.end !== undefined
          ? track.end - (track.start ?? 0)
          : resolveTrackDurationSec(
              track,
              liveFileDurations.get(join(row.physicalPath, track.file)) ?? null,
            );
      return { ...track, durationSec };
    }),
  }));
  const resume = resolveResume(row, playlists);
  return parseRecord(
    workSchema,
    {
      id: row.id,
      title: row.title,
      cover: projectCover(row.coverImage, row.coverWidth, row.coverHeight),
      status: row.status,
      physicalPath: row.physicalPath,
      totalDurationSec: row.totalDurationSec,
      addedAt: row.addedAt,
      errorMessage: row.errorMessage,
      urls: parseJsonField(row.urlsJson, "works", row.id, "urls_json"),
      tags: tagNames,
      defaultPlaylistId: row.defaultPlaylistId,
      createdAt: row.createdAt,
      playlists,
      bookmarked: row.bookmarked,
      lastPlayedAt: row.lastPlayedAt,
      resume,
      dlsite,
    },
    "works",
    row.id,
  );
}

/** catalogでIDと区間を解決できない行は、user DBに残したままAPIでは無効にする。 */
function resolveResume(row: WorkRow, playlists: ResolvedPlaylist[]): Work["resume"] {
  const { resumePlaylistId: playlistId, resumeTrackId: trackId, resumeOffsetSec: offsetSec } = row;
  if (!row.resumeResolved || playlistId === null || trackId === null || offsetSec === null) {
    return null;
  }
  const playlist = playlists.find((candidate) => candidate.id === playlistId);
  const track = playlist?.tracks.find((candidate) => candidate.id === trackId);
  if (!track || offsetSec < 0) return null;
  // durationSec が未知（プローブ未取得・失敗）の場合は上限が分からないため検証をスキップする。
  if (track.durationSec !== null && offsetSec > track.durationSec) return null;
  return { playlistId, trackId, offsetSec };
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! & 0x7fffffff;
}

/** SQLite の IN 句パラメータ上限を避けるため、配列を一定件数ごとに分割する */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

  /**
   * end未指定トラックが参照するファイルの現在の audio_probe_cache 値を、
   * 作品内の全該当パスを一括取得して求める（N+1回避）。ここでは probe を実行せず、
   * 既にキャッシュされている値をそのまま読む（フレッシュネス確認はスキャン/probe実行時に行う）。
   */
  private liveFileDurationMap(
    physicalPath: string,
    playlists: Array<{ tracks: Array<{ file: string; end?: number }> }>,
  ): Map<string, number | null> {
    const paths = [
      ...new Set(
        playlists
          .flatMap((p) => p.tracks)
          .filter((t) => t.end === undefined)
          .map((t) => join(physicalPath, t.file)),
      ),
    ];
    const map = new Map<string, number | null>();
    if (paths.length === 0) return map;
    const placeholders = paths.map(() => "?").join(", ");
    const rows = this.db.sqlite
      .query(
        `SELECT path, duration_sec AS durationSec FROM main.audio_probe_cache WHERE path IN (${placeholders})`,
      )
      .all(...paths) as Array<{ path: string; durationSec: number | null }>;
    for (const row of rows) map.set(row.path, row.durationSec);
    return map;
  }

  // ── タグ ──────────────────────────────────────────────────

  /**
   * workId → タグ名一覧のマップを作る（対象未指定なら全件）。
   * SQLite のパラメータ上限を避けるため、対象指定時は一定件数ごとに分割して取得する。
   */
  private tagMap(workIds?: string[]): Map<string, string[]> {
    const baseSql = `
      SELECT work_tags.work_id AS workId, tags.name AS name
      FROM main.work_tags AS work_tags
      INNER JOIN main.tags AS tags ON tags.id = work_tags.tag_id
    `;
    const rows = (
      workIds === undefined
        ? this.db.sqlite.query(baseSql).all()
        : chunk(workIds, 900).flatMap((idsChunk) =>
            this.db.sqlite
              .query(
                `${baseSql} WHERE work_tags.work_id IN (${idsChunk.map(() => "?").join(", ")})`,
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

  /** 一覧で使うサークル名だけをページ対象へ一括取得する。タグ全体は復元しない。 */
  private circleNameMap(workIds: string[]): Map<string, string> {
    if (workIds.length === 0) return new Map();
    const rows = this.db.sqlite
      .query(
        `
          SELECT work_tags.work_id AS workId, tags.name AS name
          FROM main.work_tags AS work_tags
          INNER JOIN main.tags AS tags ON tags.id = work_tags.tag_id
          WHERE work_tags.work_id IN (${workIds.map(() => "?").join(", ")})
            AND (tags.name LIKE 'サークル/%' OR tags.name LIKE 'circle/%')
          ORDER BY work_tags.work_id, tags.name COLLATE BINARY ASC
        `,
      )
      .all(...workIds) as Array<{ workId: string; name: string }>;
    const map = new Map<string, string>();
    for (const row of rows) {
      if (!map.has(row.workId)) map.set(row.workId, row.name.slice(row.name.indexOf("/") + 1));
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

  /** state_json を検証して DlsiteState に復元する。行がない（null）場合は空状態 */
  private parseDlsiteStateJson(workId: string, stateJson: string | null): DlsiteState {
    if (stateJson === null) return emptyDlsiteState();
    return parseRecord(
      dlsiteStateSchema,
      parseJsonField(stateJson, "work_dlsite", workId, "state_json"),
      "work_dlsite",
      workId,
    );
  }

  private dlsiteState(workId: string): DlsiteState {
    const row = this.db.catalog
      .select()
      .from(workDlsite)
      .where(eq(workDlsite.workId, workId))
      .get();
    return this.parseDlsiteStateJson(workId, row?.stateJson ?? null);
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
        works.cover_width AS coverWidth,
        works.cover_height AS coverHeight,
        works.default_playlist_id AS defaultPlaylistId,
        works.created_at AS createdAt,
        works.status,
        works.physical_path AS physicalPath,
        works.total_duration_sec AS totalDurationSec,
        works.track_count AS trackCount,
        works.error_message AS errorMessage,
        works.urls_json AS urlsJson,
        works.playlists_json AS playlistsJson,
        work_states.work_id AS workId,
        work_states.added_at AS addedAt,
        work_states.bookmarked,
        work_states.last_played_at AS lastPlayedAt,
        work_states.resume_playlist_id AS resumePlaylistId,
        work_states.resume_track_id AS resumeTrackId,
        work_states.resume_offset_sec AS resumeOffsetSec,
        CASE WHEN EXISTS (
          SELECT 1 FROM main.playlists AS resume_playlists
          INNER JOIN main.tracks AS resume_tracks
            ON resume_tracks.playlist_id = resume_playlists.id
          WHERE resume_playlists.work_id = works.id
            AND resume_playlists.id = work_states.resume_playlist_id
            AND resume_tracks.work_id = works.id
            AND resume_tracks.id = work_states.resume_track_id
            AND work_states.resume_offset_sec >= 0
            AND (resume_tracks.end IS NULL OR work_states.resume_offset_sec <= resume_tracks.end - COALESCE(resume_tracks.start, 0))
        ) THEN 1 ELSE 0 END AS resumeResolved
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
      resumeResolved: row.resumeResolved !== 0,
    }));
  }

  /**
   * 一覧専用クエリ。dlsite まで JOIN して一括取得し、playlists_json は読まない（TASK-57）。
   * SQL 発行数は作品数に比例しない（本クエリ + tagMap の定数2本）。
   * workIds を指定すると、その集合だけを対象にする（TASK-85: スマートフォルダーの候補絞り込み後の取得用）。
   * SQLite のパラメータ上限を避けるため、一定件数ごとに分割して IN 句で取得する。
   */
  listSummaries(workIds?: string[]): WorkSummary[] {
    if (workIds !== undefined && workIds.length === 0) return [];

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
    const chunkSize = 900; // SQLite パラメータ上限に余裕を持たせる
    const rows: RawSummaryListRow[] =
      workIds === undefined
        ? (this.db.sqlite.query(baseSql).all() as RawSummaryListRow[])
        : chunk(workIds, chunkSize).flatMap(
            (idsChunk) =>
              this.db.sqlite
                .query(`${baseSql} WHERE works.id IN (${idsChunk.map(() => "?").join(", ")})`)
                .all(...idsChunk) as RawSummaryListRow[],
          );
    const tagsByWork = this.tagMap(workIds);
    return rows.map((rawRow) => {
      const row: SummaryRow = { ...rawRow, bookmarked: rawRow.bookmarked !== 0 };
      return rowToSummary(
        row,
        tagsByWork.get(row.id) ?? [],
        this.parseDlsiteStateJson(row.id, rawRow.dlsiteStateJson),
      );
    });
  }

  /**
   * スマートフォルダー評価の第1段（ADR-0008）。SQLへ落とせるルール条件で候補IDへ絞り込む。
   * ルールなしはSQLで絞り込めないため null を返し、呼び出し側は全件を使う。
   * ルールがある場合は各ルールに一致するIDの和集合を返す（AND/OR/AND NOTの畳み込みは行わない）。
   * WHERE始端のリセットやAND NOTでの除外があっても、最終結果は必ずどこかのルールの一致集合に
   * 含まれるため、和集合は安全な上界になる。畳み込み・最終フィルタ・ソート・ページングは
   * core/smartFolder.ts の純粋関数が候補の WorkSummary に対して行う。
   */
  resolveSmartFolderCandidateIds(rules: SmartFolderRule[]): Set<string> | null {
    if (rules.length === 0) return null;

    const predicates: string[] = [];
    const bindings: Array<string | number> = [];
    for (const rule of rules) {
      switch (rule.field) {
        case "タグ": {
          const normalized = rule.values.map(normalizeTag);
          const placeholders = normalized.map(() => "?").join(", ");
          predicates.push(`EXISTS (
            SELECT 1
            FROM main.work_tags AS rule_work_tags
            INNER JOIN main.tags AS rule_tags ON rule_tags.id = rule_work_tags.tag_id
            WHERE rule_work_tags.work_id = works.id AND rule_tags.name IN (${placeholders})
          )`);
          bindings.push(...normalized);
          break;
        }
        case "長さ": {
          const minSec = Number(rule.values[0]);
          if (!Number.isFinite(minSec)) {
            throw new Error(`スマートフォルダーの長さ条件が不正です: ${rule.values[0]}`);
          }
          predicates.push("works.total_duration_sec >= ?");
          bindings.push(minSec);
          break;
        }
        default:
          throw new Error(`未対応のスマートフォルダールールです: ${JSON.stringify(rule)}`);
      }
    }

    const rows = this.db.sqlite
      .query(`SELECT works.id AS id FROM main.works WHERE ${predicates.join(" OR ")}`)
      .all(...bindings) as Array<{ id: string }>;
    return new Set(rows.map((row) => row.id));
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
      // 一覧DTOに必要なスカラー列だけを取得する。物理パス・JSON列・DLsite状態・タグ全体は
      // ここで読まない。サークル名はページ対象だけを別クエリで一括取得する。
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
          work_states.bookmarked,
          work_states.last_played_at AS lastPlayedAt
        ${fromSql}
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
        cover: projectCover(row.coverImage, row.coverWidth, row.coverHeight),
        status: row.status,
        totalDurationSec: row.totalDurationSec,
        trackCount: row.trackCount,
        bookmarked: row.bookmarked !== 0,
        lastPlayedAt: row.lastPlayedAt,
        circleName: circleNames.get(row.id) ?? null,
      }));
      return seed === undefined
        ? { items, total: countRow.total }
        : { items, total: countRow.total, seed };
    });
  }

  /** 通知ベル専用の集計。作品一覧を経由せず、DLsite状態だけを一括評価する。 */
  getDlsiteNotificationSummary(): DlsiteNotificationSummary {
    const row = this.db.sqlite
      .query(
        `
          SELECT
            SUM(CASE WHEN json_extract(work_dlsite.state_json, '$.rjCode') IS NULL
                           AND COALESCE(json_extract(work_dlsite.state_json, '$.status'), 'none') != 'skipped'
                     THEN 1 ELSE 0 END) AS rjCodeMissingCount,
            SUM(CASE WHEN json_extract(work_dlsite.state_json, '$.status') IN ('error', 'not_found')
                     THEN 1 ELSE 0 END) AS fetchFailedCount,
            SUM(CASE WHEN json_extract(work_dlsite.state_json, '$.rjCode') IS NOT NULL
                           AND json_extract(work_dlsite.state_json, '$.status') = 'none'
                     THEN 1 ELSE 0 END) AS unlinkedCount
          FROM main.works AS works
          LEFT JOIN main.work_dlsite AS work_dlsite ON work_dlsite.work_id = works.id
        `,
      )
      .get() as {
      rjCodeMissingCount: number | null;
      fetchFailedCount: number | null;
      unlinkedCount: number | null;
    };
    return {
      rjCodeMissingCount: row.rjCodeMissingCount ?? 0,
      fetchFailedCount: row.fetchFailedCount ?? 0,
      unlinkedCount: row.unlinkedCount ?? 0,
    };
  }

  /** RJ未検出・取得失敗モーダルのページ。物理パス等を返さない専用DTO。 */
  queryDlsiteNotifications(
    kind: "rj-missing" | "fetch-failed",
    query: Required<DlsiteNotificationQuery>,
  ): DlsiteNotificationPage {
    const condition =
      kind === "rj-missing"
        ? `json_extract(work_dlsite.state_json, '$.rjCode') IS NULL
           AND COALESCE(json_extract(work_dlsite.state_json, '$.status'), 'none') != 'skipped'`
        : `json_extract(work_dlsite.state_json, '$.status') IN ('error', 'not_found')`;
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
      status: "none" | "applied" | "not_found" | "error" | "skipped";
    }>;
    return { items: rows, total: count.total };
  }

  /**
   * 増分スキャン用の既存作品状態を一括取得する（TASK-75）。
   * ここではresumeを解決しないため、audio_probe_cacheへの作品ごとのSELECTは発生しない。
   */
  getScanWorkMap(): Map<string, ScanWorkState> {
    const rows = this.db.sqlite
      .query(
        `
          SELECT
            works.id AS id,
            works.fingerprint AS fingerprint,
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
      fingerprint: string | null;
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
        fingerprint: row.fingerprint,
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

  /**
   * 指定された音声パスの probe cache を一括取得する（TASK-75）。
   * SQLite のパラメータ上限を避けるため、一定件数ごとに分割して IN 句で取得する。
   */
  fetchProbeCache(
    paths: string[],
  ): Map<string, { size: number; mtimeMs: number; durationSec: number | null }> {
    const map = new Map<string, { size: number; mtimeMs: number; durationSec: number | null }>();
    const uniquePaths = [...new Set(paths)];
    if (uniquePaths.length === 0) return map;

    const chunkSize = 900; // SQLite パラメータ上限に余裕を持たせる
    for (let i = 0; i < uniquePaths.length; i += chunkSize) {
      const chunk = uniquePaths.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "?").join(", ");
      const rows = this.db.sqlite
        .query(
          `SELECT path, size, mtime_ms AS mtimeMs, duration_sec AS durationSec FROM main.audio_probe_cache WHERE path IN (${placeholders})`,
        )
        .all(...chunk) as Array<{
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

    if (axis === "tag") {
      return this.db.sqlite
        .query(`
          SELECT tags.name AS value, COUNT(*) AS count
          FROM main.works
          INNER JOIN user.work_states AS work_states ON work_states.work_id = works.id
          INNER JOIN main.work_tags AS work_tags ON work_tags.work_id = works.id
          INNER JOIN main.tags AS tags ON tags.id = work_tags.tag_id
          WHERE instr(tags.name, '/') = 0
          GROUP BY tags.name
          ORDER BY count DESC, tags.facet_sort_key COLLATE BINARY ASC, value COLLATE BINARY ASC
        `)
        .all() as AxisFacetItem[];
    }

    return this.db.sqlite
      .query(`
        SELECT substr(tags.name, instr(tags.name, '/') + 1) AS value, COUNT(*) AS count
        FROM main.works
        INNER JOIN user.work_states AS work_states ON work_states.work_id = works.id
        INNER JOIN main.work_tags AS work_tags ON work_tags.work_id = works.id
        INNER JOIN main.tags AS tags ON tags.id = work_tags.tag_id
        WHERE substr(tags.name, 1, instr(tags.name, '/') - 1) = ?
        GROUP BY value
        ORDER BY count DESC, tags.facet_sort_key COLLATE BINARY ASC, value COLLATE BINARY ASC
      `)
      .all(axis) as AxisFacetItem[];
  }

  getWork(id: string): Work | null {
    const row = this.joinedWorks("WHERE works.id = ?", id)[0];
    if (!row) return null;
    const rawPlaylists = parseWorkPlaylists(row);
    return rowToWork(
      row,
      rawPlaylists,
      this.tagMap([id]).get(id) ?? [],
      this.dlsiteState(id),
      this.liveFileDurationMap(row.physicalPath, rawPlaylists),
    );
  }

  /**
   * カバー配信専用の一点取得。getWork() のJSON復元・関連表問い合わせを避けるため、
   * ルートとファイル名だけを1クエリで取得する。
   */
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

  getWorkByPhysicalPath(physicalPath: string): Work | null {
    const row = this.joinedWorks("WHERE works.physical_path = ?", physicalPath)[0];
    if (!row) return null;
    const rawPlaylists = parseWorkPlaylists(row);
    return rowToWork(
      row,
      rawPlaylists,
      this.tagMap([row.id]).get(row.id) ?? [],
      this.dlsiteState(row.id),
      this.liveFileDurationMap(row.physicalPath, rawPlaylists),
    );
  }

  /**
   * scan からの登録。タグも置き換える。
   * カバー列は options.cover（.meta.json のファイル名＋計測寸法）を正とし、省略時は work.cover から導く。
   * options.cover は「画像あり・寸法null（計測失敗）」も表現でき、work.cover では表せない状態を書ける。
   */
  upsertWork(work: Work, options?: { fingerprint?: string; cover?: CoverColumns }): void {
    // 2DBをまたぐ原子性には依存せず、user状態を先に冪等作成してからcatalogを書く。
    this.db.user
      .insert(workStates)
      .values({
        workId: work.id,
        addedAt: work.addedAt,
        bookmarked: work.bookmarked,
        lastPlayedAt: work.lastPlayedAt,
        resumePlaylistId: work.resume?.playlistId ?? null,
        resumeTrackId: work.resume?.trackId ?? null,
        resumeOffsetSec: work.resume?.offsetSec ?? null,
      })
      .onConflictDoNothing()
      .run();
    // track_count はデフォルトプレイリストのトラック数（一覧がplaylists_jsonを読まないためここで維持。TASK-57）
    const trackCount =
      defaultPlaylistOf({ id: work.id, defaultPlaylistId: work.defaultPlaylistId }, work.playlists)
        ?.tracks.length ?? 0;
    const cover = options?.cover ?? coverColumnsFromCover(work.cover);
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
      totalDurationSec: work.totalDurationSec,
      trackCount,
      fingerprint: options?.fingerprint ?? null,
      errorMessage: work.errorMessage,
      urlsJson: JSON.stringify(work.urls),
      // durationSec は派生値のため正本（playlists_json）には書かず、読み取り時に動的解決する。
      playlistsJson: JSON.stringify(
        work.playlists.map((playlist) => ({
          id: playlist.id,
          name: playlist.name,
          tracks: playlist.tracks.map(({ durationSec: _durationSec, ...track }) => track),
        })),
      ),
    };
    this.db.catalog
      .insert(works)
      .values(values)
      .onConflictDoUpdate({ target: works.id, set: values })
      .run();
    this.db.catalog.delete(catalogPlaylists).where(eq(catalogPlaylists.workId, work.id)).run();
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

  /** PATCH /works/:id および DLsite 適用の DB 側。メタファイル書き戻しは呼び出し側（アダプタ）が行う */
  patchWork(
    id: string,
    patch: {
      title?: string;
      tags?: string[];
      bookmarked?: boolean;
      cover?: CoverColumns;
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
    if (patch.cover !== undefined) {
      set.coverImage = patch.cover.image;
      set.coverWidth = patch.cover.dimensions?.width ?? null;
      set.coverHeight = patch.cover.dimensions?.height ?? null;
    }
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

  saveResume(id: string, body: ResumeBody): boolean {
    if (!this.db.catalog.select({ id: works.id }).from(works).where(eq(works.id, id)).get()) {
      return false;
    }
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
      .get(id, body.playlistId, id, body.trackId) as {
      start: number | null;
      end: number | null;
      file: string;
      physicalPath: string;
    } | null;
    if (!track) {
      throw new InvalidResumeError("resumeのPlaylistまたはTrackが作品に属していません");
    }
    // end指定済みは自明値（end-start）、未指定はaudio_probe_cacheの現在値から解決する。
    const durationSec =
      track.end !== null
        ? track.end - (track.start ?? 0)
        : resolveTrackDurationSec(
            { start: track.start ?? undefined },
            this.db.catalog
              .select({ durationSec: audioProbeCache.durationSec })
              .from(audioProbeCache)
              .where(eq(audioProbeCache.path, join(track.physicalPath, track.file)))
              .get()?.durationSec ?? null,
          );
    // durationSec が未知（プローブ未取得・失敗）の場合は上限が分からないため検証をスキップする。
    if (body.offsetSec < 0 || (durationSec !== null && body.offsetSec > durationSec)) {
      throw new InvalidResumeError("resumeのoffsetSecがトラック区間外です");
    }
    const r = this.db.user
      .update(workStates)
      .set({
        resumePlaylistId: body.playlistId,
        resumeTrackId: body.trackId,
        resumeOffsetSec: body.offsetSec,
      })
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
    // NOT IN のプレースホルダーがSQLiteパラメータ上限に達しないよう、
    // seen ID は一時テーブルへ入れてサブクエリで参照する（TASK-62）。
    // 失敗時に中途半端な一時テーブルを残さないよう finally で必ず破棄する。
    const sqlite = this.db.sqlite;
    sqlite.exec("DROP TABLE IF EXISTS temp.scan_seen_ids");
    sqlite.exec("CREATE TEMP TABLE scan_seen_ids (id TEXT PRIMARY KEY)");
    try {
      const insert = sqlite.prepare("INSERT INTO temp.scan_seen_ids (id) VALUES (?)");
      sqlite.transaction((ids: string[]) => {
        for (const id of ids) insert.run(id);
      })(foundIds);
      sqlite.exec(
        "UPDATE main.works SET status = 'missing', error_message = NULL " +
          "WHERE id NOT IN (SELECT id FROM temp.scan_seen_ids)",
      );
    } finally {
      sqlite.exec("DROP TABLE IF EXISTS temp.scan_seen_ids");
    }
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
