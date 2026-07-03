// SQLite スキーマ（Drizzle）。DB は検索用キャッシュ + DB固有情報の置き場。
// `.meta.json` が Source of Truth であり、works / tags / work_tags は再スキャンで再構築できる。
// smart_folders / search_presets / app_settings / works の bookmark・resume 系は DB のみが持つ。
// DDL は db.ts の CREATE TABLE IF NOT EXISTS と手動で同期する（キャッシュ DB のため
// 互換マイグレーションは持たない。スキーマ変更時は user_version を上げて作り直す）。
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Playlist, UrlEntry, SmartFolderRule } from "@mimimilli/shared";

export const works = sqliteTable("works", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  coverImage: text("cover_image"),
  defaultPlaylist: text("default_playlist"),
  createdAt: text("created_at"),
  status: text("status").notNull(),
  physicalPath: text("physical_path").notNull(),
  totalDurationSec: real("total_duration_sec").notNull().default(0),
  addedAt: text("added_at").notNull(),
  errorMessage: text("error_message"),
  urlsJson: text("urls_json", { mode: "json" }).$type<UrlEntry[]>().notNull(),
  playlistsJson: text("playlists_json", { mode: "json" }).$type<Playlist[]>().notNull(),
  bookmarked: integer("bookmarked", { mode: "boolean" }).notNull().default(false),
  lastPlayedAt: text("last_played_at"),
  resumePosition: real("resume_position").notNull().default(0),
  resumeTrackIndex: integer("resume_track_index").notNull().default(0),
});

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
  (t) => [primaryKey({ columns: [t.workId, t.tagId] }), index("idx_work_tags_tag").on(t.tagId)]
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});

export const searchPresets = sqliteTable("search_presets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  query: text("query").notNull(),
  tagFiltersJson: text("tag_filters_json", { mode: "json" }).$type<string[]>().notNull(),
  sortId: text("sort_id").notNull(),
});

export const smartFolders = sqliteTable("smart_folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rulesJson: text("rules_json", { mode: "json" }).$type<SmartFolderRule[]>().notNull(),
  sort: text("sort").notNull(),
  createdAt: text("created_at").notNull(),
});

/** 音声ファイル長のプローブ結果キャッシュ。(size, mtime) が一致する間は再プローブしない */
export const audioProbeCache = sqliteTable("audio_probe_cache", {
  path: text("path").primaryKey(),
  size: integer("size").notNull(),
  mtimeMs: integer("mtime_ms").notNull(),
  durationSec: real("duration_sec").notNull(),
});
