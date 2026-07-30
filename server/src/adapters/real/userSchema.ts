import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const smartFolders = sqliteTable("smart_folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rulesJson: text("rules_json").notNull(),
  sort: text("sort").notNull(),
  createdAt: text("created_at").notNull(),
});
