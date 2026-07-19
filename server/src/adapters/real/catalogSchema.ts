import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** `.meta.json` とファイル走査から再構築できる作品カタログ。 */
export const works = sqliteTable(
  "works",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    coverImage: text("cover_image"),
    defaultPlaylist: text("default_playlist"),
    createdAt: text("created_at"),
    status: text("status").notNull(),
    physicalPath: text("physical_path").notNull(),
    totalDurationSec: real("total_duration_sec").notNull().default(0),
    errorMessage: text("error_message"),
    urlsJson: text("urls_json").notNull(),
    playlistsJson: text("playlists_json").notNull(),
  },
  (table) => [index("idx_works_physical_path").on(table.physicalPath)],
);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
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

/** 音声ファイル長のプローブ結果キャッシュ。 */
export const audioProbeCache = sqliteTable("audio_probe_cache", {
  path: text("path").primaryKey(),
  size: integer("size").notNull(),
  mtimeMs: integer("mtime_ms").notNull(),
  durationSec: real("duration_sec").notNull(),
});
