// SQLite 接続と DDL 初期化。WAL モード。
// スキーマ変更時は SCHEMA_VERSION を上げる → 全テーブルを作り直す（DB はキャッシュなので
// 再スキャンで復元できる。ただし DB 固有情報も消えるため、バージョンアップは慎重に行うこと）。
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const SCHEMA_VERSION = 1;

const DDL = `
CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cover_image TEXT,
  default_playlist TEXT,
  created_at TEXT,
  status TEXT NOT NULL,
  physical_path TEXT NOT NULL,
  total_duration_sec REAL NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL,
  error_message TEXT,
  urls_json TEXT NOT NULL,
  playlists_json TEXT NOT NULL,
  bookmarked INTEGER NOT NULL DEFAULT 0,
  last_played_at TEXT,
  resume_position REAL NOT NULL DEFAULT 0,
  resume_track_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_works_physical_path ON works(physical_path);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS work_tags (
  work_id TEXT NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (work_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_work_tags_tag ON work_tags(tag_id);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS search_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  tag_filters_json TEXT NOT NULL,
  sort_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS smart_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rules_json TEXT NOT NULL,
  sort TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audio_probe_cache (
  path TEXT PRIMARY KEY,
  size INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,
  duration_sec REAL NOT NULL
);
`;

export type Db = BetterSQLite3Database;

/** DB を開き、スキーマを初期化して Drizzle インスタンスを返す。":memory:" も可（テスト用） */
export function openDb(dbPath: string): Db {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const current = sqlite.pragma("user_version", { simple: true }) as number;
  if (current !== 0 && current !== SCHEMA_VERSION) {
    throw new Error(
      `DB スキーマバージョン不一致（DB: v${current}, アプリ: v${SCHEMA_VERSION}）。` +
        `キャッシュ DB を削除して再スキャンしてください: ${dbPath}`,
    );
  }
  sqlite.exec(DDL);
  sqlite.pragma(`user_version = ${SCHEMA_VERSION}`);

  return drizzle(sqlite);
}
