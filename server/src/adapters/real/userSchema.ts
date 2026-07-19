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
  // Playlist/Track ID移行までは既存APIのresume v1を保持する。
  resumePosition: real("resume_position").notNull().default(0),
  resumeTrackIndex: integer("resume_track_index").notNull().default(0),
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
