// migration 0006（audio_probe_cacheのNULLABLE化）が、TASK-92以前の実データに対して
// 安全に働くことを検証する。CATALOG_SCHEMA_VERSIONは0006/0007導入時にバンプしていないため、
// 既存の v6 catalog DBはワイプされず、この2ファイルがインクリメンタルに適用される
// （db.ts の openVersionedDatabase は user_version 不一致時のみ全体を再作成するため）。
import assert from "node:assert/strict";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { openDb } from "../../src/adapters/real/db.ts";
import { works } from "../../src/adapters/real/catalogSchema.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

const CATALOG_MIGRATIONS_DIR = join(import.meta.dir, "../../drizzle/catalog");
const USER_MIGRATIONS_DIR = join(import.meta.dir, "../../drizzle/user");

/** catalogに作品がある場合、openDbの整合性チェックが対応するuser状態を要求する。 */
function seedUserWorkState(userPath: string, workId: string): void {
  const sqlite = new Database(userPath, { create: true });
  migrate(drizzle(sqlite), { migrationsFolder: USER_MIGRATIONS_DIR });
  sqlite.exec(`INSERT INTO work_states (work_id, added_at) VALUES ('${workId}', '2026-01-01')`);
  sqlite.close();
}

/** 0006/0007 適用前（TASK-92導入前）の migrations フォルダーを一時ディレクトリへ再現する。 */
function buildPreTask92MigrationsDir(destDir: string): void {
  cpSync(CATALOG_MIGRATIONS_DIR, destDir, { recursive: true });
  for (const tag of ["0006_heavy_emma_frost", "0007_hesitant_robin_chapel"]) {
    require("node:fs").rmSync(join(destDir, `${tag}.sql`), { force: true });
    require("node:fs").rmSync(join(destDir, "meta", `${tag.slice(0, 4)}_snapshot.json`), {
      force: true,
    });
  }
  const journalPath = join(destDir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: Array<{ tag: string }>;
  };
  journal.entries = journal.entries.filter(
    (entry) => entry.tag !== "0006_heavy_emma_frost" && entry.tag !== "0007_hesitant_robin_chapel",
  );
  writeFileSync(journalPath, JSON.stringify(journal, null, 2));
}

test("migration 0006: 旧実装が0秒で保存したaudio_probe_cacheをNULLへ変換する", (t) => {
  const directory = makeTestDirectory("catalog-migration-probe-cache");
  t.after(directory.cleanup);
  const preMigrationsDir = join(directory.path, "pre-migrations");
  mkdirSync(preMigrationsDir, { recursive: true });
  buildPreTask92MigrationsDir(preMigrationsDir);

  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const sqlite = new Database(catalogPath, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL");
  migrate(drizzle(sqlite), { migrationsFolder: preMigrationsDir });
  sqlite.exec("PRAGMA user_version = 6"); // TASK-91時点で既にv6

  // 旧実装（probe失敗/解析失敗時にdurationSec:0で保存）が残した行を再現する。
  sqlite.exec(
    `INSERT INTO audio_probe_cache (path, size, mtime_ms, duration_sec) VALUES ('/lib/broken.wav', 100, 1000, 0)`,
  );
  sqlite.exec(
    `INSERT INTO audio_probe_cache (path, size, mtime_ms, duration_sec) VALUES ('/lib/ok.wav', 200, 2000, 30.5)`,
  );
  sqlite.close();

  const userPath = join(directory.path, "db", "user.sqlite");
  const db = openDb({ kind: "files", catalogPath, userPath });
  const rows = db.sqlite
    .query("SELECT path, duration_sec AS durationSec FROM audio_probe_cache ORDER BY path")
    .all() as Array<{ path: string; durationSec: number | null }>;
  assert.deepEqual(rows, [
    { path: "/lib/broken.wav", durationSec: null },
    { path: "/lib/ok.wav", durationSec: 30.5 },
  ]);
  db.close();
});

test("migration 0006: 既存作品のfingerprintを無効化し次回スキャンで全playlistを再処理させる", (t) => {
  const directory = makeTestDirectory("catalog-migration-fingerprint-invalidation");
  t.after(directory.cleanup);
  const preMigrationsDir = join(directory.path, "pre-migrations");
  mkdirSync(preMigrationsDir, { recursive: true });
  buildPreTask92MigrationsDir(preMigrationsDir);

  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const sqlite = new Database(catalogPath, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL");
  migrate(drizzle(sqlite), { migrationsFolder: preMigrationsDir });
  sqlite.exec("PRAGMA user_version = 6");
  sqlite.exec(`
    INSERT INTO works (
      id, title, title_sort_key, status, physical_path,
      total_duration_sec, track_count, fingerprint, urls_json, playlists_json
    ) VALUES (
      'w-existing', 't', 't', 'ok', '/lib/w',
      10, 1, 'unchanged-fingerprint', '[]', '[]'
    )
  `);
  sqlite.close();

  const userPath = join(directory.path, "db", "user.sqlite");
  seedUserWorkState(userPath, "w-existing");
  const db = openDb({ kind: "files", catalogPath, userPath });
  const row = db.catalog.select().from(works).where(eq(works.id, "w-existing")).get();
  assert.equal(row?.fingerprint, null);
  db.close();
});
