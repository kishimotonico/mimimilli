import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** user DB自体の移行状態。アプリ設定と寿命・用途を混在させない。 */
export const persistenceMeta = sqliteTable("persistence_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Work UUID に紐づく、再スキャンでは復元できない状態。DB間外部キーは置かない。 */
export const workStates = sqliteTable("work_states", {
  workId: text("work_id").primaryKey(),
  addedAt: text("added_at").notNull(),
  bookmarked: integer("bookmarked", { mode: "boolean" }).notNull().default(false),
  lastPlayedAt: text("last_played_at"),
  resumePlaylistId: text("resume_playlist_id"),
  resumeTrackId: text("resume_track_id"),
  resumeOffsetSec: real("resume_offset_sec"),
});

/** v1からv2への変換時だけ使う一時データ。変換後は行を残さない。 */
export const resumeV1Pending = sqliteTable("resume_v1_pending", {
  workId: text("work_id").primaryKey(),
  position: real("position").notNull(),
  trackIndex: integer("track_index").notNull(),
});

/** タグ prefix 定義。id は表示順（登録順）の安定化用で、APIのキーは prefix。 */
export const tagPrefixes = sqliteTable("tag_prefixes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  prefix: text("prefix").notNull().unique(),
  label: text("label").notNull(),
  color: text("color"),
  showAsAxis: integer("show_as_axis", { mode: "boolean" }).notNull().default(true),
  protected: integer("protected", { mode: "boolean" }).notNull().default(false),
});

/** userに分類済みのキーだけを保存するKV。 */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});

export const searchPresets = sqliteTable("search_presets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  query: text("query").notNull(),
  tagFiltersJson: text("tag_filters_json").notNull(),
  sortId: text("sort_id").notNull(),
});

export const smartFolders = sqliteTable("smart_folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rulesJson: text("rules_json").notNull(),
  sort: text("sort").notNull(),
  createdAt: text("created_at").notNull(),
});
