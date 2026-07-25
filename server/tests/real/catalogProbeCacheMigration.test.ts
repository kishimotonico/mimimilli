// migration 0006（audio_probe_cacheのNULLABLE化）と0008（0秒probe cache/fingerprintのデータ補正）が、
// TASK-92以前の実データに対して安全に働くことを検証する。CATALOG_SCHEMA_VERSIONは0006/0007/0008導入時に
// バンプしていないため、既存の v6 catalog DBはワイプされず、これらのファイルがインクリメンタルに
// 適用される（db.ts の openVersionedDatabase は user_version 不一致時のみ全体を再作成するため）。
//
// drizzleのmigrate()は各migrationファイルのハッシュではなく__drizzle_migrations.created_atと
// journalの'when'(folderMillis)の大小だけで適用要否を決める。そのため、0006の中身を後から書き換えても
// 「0006を過去に適用済み」のDBでは新しい中身が実行されない（このファイルが一度失敗した経緯）。
// データ補正は必ず新しいtimestampを持つ独立migration（0008）に置き、既に0006/0007を適用済みのDBでも
// 0008だけが新規適用されることを保証する。
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

/** 0006/0007/0008 適用前（TASK-92導入前）の migrations フォルダーを一時ディレクトリへ再現する。 */
function buildPreTask92MigrationsDir(destDir: string): void {
  cpSync(CATALOG_MIGRATIONS_DIR, destDir, { recursive: true });
  for (const tag of [
    "0006_heavy_emma_frost",
    "0007_hesitant_robin_chapel",
    "0008_probe_cache_zero_duration_backfill",
  ]) {
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
    (entry) =>
      entry.tag !== "0006_heavy_emma_frost" &&
      entry.tag !== "0007_hesitant_robin_chapel" &&
      entry.tag !== "0008_probe_cache_zero_duration_backfill",
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

/**
 * 「旧0006（データ補正を持たない素の内容）を既に適用済み」のmigrationsフォルダーを再現する。
 * 0006/0007のtagはそのまま残し、0006の中身だけ drizzle-kit 生成の素の内容に差し替え、0008は
 * まだ存在しない状態にする。この状態からproductionのmigrationsFolder（0006は素の内容、
 * データ補正は0008）へ移行すると、0006/0007はfolderMillis比較で「適用済み」としてスキップされ、
 * 0008だけが新規適用される。
 */
function buildLegacyVanilla0006AppliedMigrationsDir(destDir: string): void {
  cpSync(CATALOG_MIGRATIONS_DIR, destDir, { recursive: true });
  const vanilla0006 = `PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE \`__new_audio_probe_cache\` (
	\`path\` text PRIMARY KEY NOT NULL,
	\`size\` integer NOT NULL,
	\`mtime_ms\` integer NOT NULL,
	\`duration_sec\` real
);
--> statement-breakpoint
INSERT INTO \`__new_audio_probe_cache\`("path", "size", "mtime_ms", "duration_sec") SELECT "path", "size", "mtime_ms", "duration_sec" FROM \`audio_probe_cache\`;--> statement-breakpoint
DROP TABLE \`audio_probe_cache\`;--> statement-breakpoint
ALTER TABLE \`__new_audio_probe_cache\` RENAME TO \`audio_probe_cache\`;--> statement-breakpoint
PRAGMA foreign_keys=ON;`;
  writeFileSync(join(destDir, "0006_heavy_emma_frost.sql"), vanilla0006);
  require("node:fs").rmSync(join(destDir, "0008_probe_cache_zero_duration_backfill.sql"), {
    force: true,
  });
  require("node:fs").rmSync(join(destDir, "meta", "0008_snapshot.json"), { force: true });
  const journalPath = join(destDir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: Array<{ tag: string }>;
  };
  journal.entries = journal.entries.filter(
    (entry) => entry.tag !== "0008_probe_cache_zero_duration_backfill",
  );
  writeFileSync(journalPath, JSON.stringify(journal, null, 2));
}

test("migration 0008: 旧0006（データ補正なし）を適用済みのDBでも0秒probe cacheとfingerprintの補正が当たる", (t) => {
  const directory = makeTestDirectory("catalog-migration-legacy-0006-applied");
  t.after(directory.cleanup);
  const preMigrationsDir = join(directory.path, "pre-migrations");
  mkdirSync(preMigrationsDir, { recursive: true });
  buildLegacyVanilla0006AppliedMigrationsDir(preMigrationsDir);

  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const sqlite = new Database(catalogPath, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL");
  migrate(drizzle(sqlite), { migrationsFolder: preMigrationsDir });
  sqlite.exec("PRAGMA user_version = 6");

  // 旧0006適用後・0008導入前の状態を再現する：データ補正が一度も走っていないため
  // 0秒のprobe cache行が残り、再スキャン済みでfingerprintが非NULLに戻っている。
  sqlite.exec(
    `INSERT INTO audio_probe_cache (path, size, mtime_ms, duration_sec) VALUES ('/lib/broken.wav', 100, 1000, 0)`,
  );
  sqlite.exec(`
    INSERT INTO works (
      id, title, title_sort_key, status, physical_path,
      total_duration_sec, track_count, fingerprint, urls_json, playlists_json
    ) VALUES (
      'w-existing', 't', 't', 'ok', '/lib/w',
      10, 1, 'rescanned-fingerprint', '[]', '[]'
    )
  `);
  sqlite.close();

  const userPath = join(directory.path, "db", "user.sqlite");
  seedUserWorkState(userPath, "w-existing");
  const db = openDb({ kind: "files", catalogPath, userPath });

  const probeRow = db.sqlite
    .query(
      `SELECT duration_sec AS durationSec FROM audio_probe_cache WHERE path = '/lib/broken.wav'`,
    )
    .get() as { durationSec: number | null };
  assert.equal(probeRow.durationSec, null);

  const workRow = db.catalog.select().from(works).where(eq(works.id, "w-existing")).get();
  assert.equal(workRow?.fingerprint, null);
  db.close();
});
