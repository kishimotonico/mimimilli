import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/** `mimimilli.json` とファイル走査から再構築できる作品カタログ。 */
export const works = sqliteTable(
  "works",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    titleSortKey: text("title_sort_key").notNull(),
    coverImage: text("cover_image"),
    /** カバーの表示ピクセル寸法（EXIF回転後・マルチページは先頭ページ）。両NULL＝未計測/カバー無し。 */
    coverWidth: integer("cover_width"),
    coverHeight: integer("cover_height"),
    defaultPlaylistId: text("default_playlist_id"),
    createdAt: text("created_at"),
    status: text("status").notNull(),
    physicalPath: text("physical_path").notNull(),
    /** スキャン時に確定したメタファイルの絶対パス（書き戻し先の正本） */
    metaPath: text("meta_path").notNull(),
    /** デフォルトプレイリストの合計秒数。未解決トラックを1件でも含む場合はNULL（未知。0では埋めない）。 */
    totalDurationSec: real("total_duration_sec"),
    /** デフォルトプレイリストのトラック数。upsert時に維持する（TASK-57: 一覧でplaylists_jsonを読まないため） */
    trackCount: integer("track_count").notNull().default(0),
    /** 増分スキャンの変更検知フィンガープリント（TASK-75で値を設定する。列はTASK-57と同じv5で先行追加） */
    fingerprint: text("fingerprint"),
    errorMessage: text("error_message"),
    urlsJson: text("urls_json").notNull(),
    playlistsJson: text("playlists_json").notNull(),
  },
  (table) => [
    index("idx_works_physical_path").on(table.physicalPath),
    index("idx_works_title_sort_key").on(table.titleSortKey, table.id),
    // 寸法は両NULL、または両方とも正の整数のみ許可する（0/1埋めや片側欠損を弾く）。
    check(
      "cover_dimensions_valid",
      sql`(${table.coverWidth} IS NULL AND ${table.coverHeight} IS NULL) OR (typeof(${table.coverWidth}) = 'integer' AND typeof(${table.coverHeight}) = 'integer' AND ${table.coverWidth} > 0 AND ${table.coverHeight} > 0)`,
    ),
  ],
);

export const playlists = sqliteTable(
  "playlists",
  {
    id: text("id").primaryKey(),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
  },
  (table) => [
    index("idx_playlists_work_position").on(table.workId, table.position),
    index("idx_playlists_work_name").on(table.workId, table.name),
  ],
);

export const tracks = sqliteTable(
  "tracks",
  {
    id: text("id").primaryKey(),
    playlistId: text("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    file: text("file").notNull(),
    start: real("start"),
    end: real("end"),
  },
  (table) => [
    index("idx_tracks_playlist_position").on(table.playlistId, table.position),
    index("idx_tracks_work").on(table.workId),
  ],
);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  searchKey: text("search_key").notNull(),
  facetSortKey: text("facet_sort_key").notNull(),
});

export const workTags = sqliteTable(
  "work_tags",
  {
    workId: text("work_id").notNull(),
    tagId: integer("tag_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workId, table.tagId] }),
    index("idx_work_tags_tag").on(table.tagId),
  ],
);

export const workDlsite = sqliteTable("work_dlsite", {
  workId: text("work_id").primaryKey(),
  stateJson: text("state_json").notNull(),
});

/** 再スキャンで更新できる運用状態。user の汎用設定とは分ける。 */
export const scanState = sqliteTable("scan_state", {
  key: text("key").primaryKey(),
  value: text("value"),
});

/** sidecar正本の Work ID が複数の場所で見つかったときの再構築可能な診断投影。 */
export const identityConflicts = sqliteTable(
  "identity_conflicts",
  {
    workId: text("work_id").notNull(),
    path: text("path").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workId, table.path] }),
    index("idx_identity_conflicts_work_id").on(table.workId),
  ],
);

/** 音声ファイル長のプローブ結果キャッシュ。durationSec は計測失敗時 NULL（未知。0 では埋めない）。 */
export const audioProbeCache = sqliteTable("audio_probe_cache", {
  path: text("path").primaryKey(),
  size: integer("size").notNull(),
  mtimeMs: integer("mtime_ms").notNull(),
  durationSec: real("duration_sec"),
});
