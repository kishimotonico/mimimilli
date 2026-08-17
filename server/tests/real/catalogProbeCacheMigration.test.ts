// migration 0006（audio_probe_cacheのNULLABLE化）と0008（0秒probe cache/fingerprintのデータ補正）が、
// TASK-92以前の実データに対して安全に働くことを検証する。0009（works.meta_path）導入で
// CATALOG_SCHEMA_VERSIONは7にバンプされ、user_version不一致の旧catalogはopenDb時に再作成される。
// 本テストは再現用migrations dirから0006-0009を除きレガシー状態を作る。works行を先に挿入する
// ケースは0009を飛ばして0006-0008だけ適用する（0009を先に記録するとfolderMillis順で0006-0008が
// スキップされるため）。0009はテスト1のopenDb経由（空のworks）で適用される。
//
// drizzleのmigrate()は各migrationファイルのハッシュではなく__drizzle_migrations.created_atと
// journalの'when'(folderMillis)の大小だけで適用要否を決める。そのため、0006の中身を後から書き換えても
// 「0006を過去に適用済み」のDBでは新しい中身が実行されない（このファイルが一度失敗した経緯）。
// データ補正は必ず新しいtimestampを持つ独立migration（0008）に置き、既に0006/0007を適用済みのDBでも
// 0008だけが新規適用されることを保証する。
import assert from "node:assert/strict";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { openDb, CATALOG_SCHEMA_VERSION } from "../../src/adapters/real/db.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

const CATALOG_MIGRATIONS_DIR = join(import.meta.dir, "../../drizzle/catalog");

/** 0006以降の適用前（TASK-92導入前）の migrations フォルダーを一時ディレクトリへ再現する。 */
function buildPreTask92MigrationsDir(destDir: string): void {
  cpSync(CATALOG_MIGRATIONS_DIR, destDir, { recursive: true });
  const journalPath = join(destDir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: Array<{ tag: string }>;
  };
  const excludedTags = journal.entries
    .filter((entry) => Number.parseInt(entry.tag.slice(0, 4), 10) >= 6)
    .map((entry) => entry.tag);
  for (const tag of excludedTags) {
    rmSync(join(destDir, `${tag}.sql`), { force: true });
    rmSync(join(destDir, "meta", `${tag.slice(0, 4)}_snapshot.json`), {
      force: true,
    });
  }
  journal.entries = journal.entries.filter((entry) => !excludedTags.includes(entry.tag));
  writeFileSync(journalPath, JSON.stringify(journal, null, 2));
}

/** 再現用migrations dirへ本番の1本を追記する（journalのwhen順序を保つ）。 */
function appendCatalogMigration(destDir: string, tag: string): void {
  cpSync(join(CATALOG_MIGRATIONS_DIR, `${tag}.sql`), join(destDir, `${tag}.sql`));
  cpSync(
    join(CATALOG_MIGRATIONS_DIR, "meta", `${tag.slice(0, 4)}_snapshot.json`),
    join(destDir, "meta", `${tag.slice(0, 4)}_snapshot.json`),
  );
  const prodJournal = JSON.parse(
    readFileSync(join(CATALOG_MIGRATIONS_DIR, "meta/_journal.json"), "utf-8"),
  ) as { entries: Array<{ tag: string }> };
  const entry = prodJournal.entries.find((item) => item.tag === tag);
  assert.ok(entry, `journal entry not found: ${tag}`);
  const journalPath = join(destDir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: Array<{ tag: string }>;
  };
  journal.entries.push(entry);
  writeFileSync(journalPath, JSON.stringify(journal, null, 2));
}

/** 再現用migrations dirへ本番の migration を複数追記する。 */
function appendCatalogMigrations(destDir: string, tags: readonly string[]): void {
  for (const tag of tags) appendCatalogMigration(destDir, tag);
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
  // openDbがDBを再作成しないよう、シード前に現行版へ合わせる。
  sqlite.exec(`PRAGMA user_version = ${CATALOG_SCHEMA_VERSION}`);

  // 旧実装（probe失敗/解析失敗時にdurationSec:0で保存）が残した行を再現する。
  sqlite.exec(
    `INSERT INTO audio_probe_cache (path, size, mtime_ms, duration_sec) VALUES ('/lib/broken.wav', 100, 1000, 0)`,
  );
  sqlite.exec(
    `INSERT INTO audio_probe_cache (path, size, mtime_ms, duration_sec) VALUES ('/lib/ok.wav', 200, 2000, 30.5)`,
  );
  sqlite.close();

  const userPath = join(directory.path, "db", "user.sqlite");
  const db = directory.own(openDb({ kind: "files", catalogPath, userPath }));
  const rows = db.sqlite
    .query("SELECT path, duration_sec AS durationSec FROM audio_probe_cache ORDER BY path")
    .all() as Array<{ path: string; durationSec: number | null }>;
  assert.deepEqual(rows, [
    { path: "/lib/broken.wav", durationSec: null },
    { path: "/lib/ok.wav", durationSec: 30.5 },
  ]);
  const metaPathColumn = db.sqlite
    .query(`SELECT COUNT(*) AS count FROM pragma_table_info('works') WHERE name = 'meta_path'`)
    .get() as { count: number };
  assert.equal(metaPathColumn.count, 1);
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
  sqlite.exec(`
    INSERT INTO works (
      id, title, title_sort_key, status, physical_path,
      total_duration_sec, track_count, fingerprint, urls_json, playlists_json
    ) VALUES (
      'w-existing', 't', 't', 'ok', '/lib/w',
      10, 1, 'unchanged-fingerprint', '[]', '[]'
    )
  `);
  // 0009を飛ばして0006-0008だけ適用する（0009を先に記録するとfolderMillis順で0006-0008がスキップされる）。
  appendCatalogMigrations(preMigrationsDir, [
    "0006_heavy_emma_frost",
    "0007_hesitant_robin_chapel",
    "0008_probe_cache_zero_duration_backfill",
  ]);
  migrate(drizzle(sqlite), { migrationsFolder: preMigrationsDir });
  const row = sqlite.query(`SELECT fingerprint FROM works WHERE id = 'w-existing'`).get() as {
    fingerprint: string | null;
  };
  assert.equal(row.fingerprint, null);
  sqlite.close();
});

/**
 * 「旧0006（データ補正を持たない素の内容）を既に適用済み」のmigrationsフォルダーを再現する。
 * 0006/0007のtagはそのまま残し、0006の中身だけ drizzle-kit 生成の素の内容に差し替え、0008は
 * まだ存在しない状態にする（0009も同様に未適用）。この状態からproductionのmigrationsFolder
 * （0006は素の内容、データ補正は0008、meta_pathは0009）へ移行すると、0006/0007はfolderMillis比較で
 * 「適用済み」としてスキップされ、0008だけが新規適用される。
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
  const journalPath = join(destDir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: Array<{ tag: string }>;
  };
  const excludedTags = journal.entries
    .filter((entry) => Number.parseInt(entry.tag.slice(0, 4), 10) >= 8)
    .map((entry) => entry.tag);
  for (const tag of excludedTags) {
    rmSync(join(destDir, `${tag}.sql`), { force: true });
    rmSync(join(destDir, "meta", `${tag.slice(0, 4)}_snapshot.json`), {
      force: true,
    });
  }
  journal.entries = journal.entries.filter((entry) => !excludedTags.includes(entry.tag));
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
  appendCatalogMigration(preMigrationsDir, "0008_probe_cache_zero_duration_backfill");
  migrate(drizzle(sqlite), { migrationsFolder: preMigrationsDir });

  const probeRow = sqlite
    .query(
      `SELECT duration_sec AS durationSec FROM audio_probe_cache WHERE path = '/lib/broken.wav'`,
    )
    .get() as { durationSec: number | null };
  assert.equal(probeRow.durationSec, null);

  const workRow = sqlite.query(`SELECT fingerprint FROM works WHERE id = 'w-existing'`).get() as {
    fingerprint: string | null;
  };
  assert.equal(workRow.fingerprint, null);
  sqlite.close();
});

test("migration 0011: playlists_jsonを削除し関係表を再構築用に空にする", (t) => {
  const directory = makeTestDirectory("catalog-migration-playlists-projection");
  t.after(directory.cleanup);
  const migrationsDir = join(directory.path, "migrations");
  mkdirSync(migrationsDir, { recursive: true });
  buildPreTask92MigrationsDir(migrationsDir);
  appendCatalogMigrations(migrationsDir, [
    "0006_heavy_emma_frost",
    "0007_hesitant_robin_chapel",
    "0008_probe_cache_zero_duration_backfill",
    "0009_gifted_sersi",
    "0010_cynical_catseye",
  ]);

  const sqlite = new Database(join(directory.path, "catalog.sqlite"), { create: true });
  migrate(drizzle(sqlite), { migrationsFolder: migrationsDir });
  sqlite.exec(`
    INSERT INTO works (
      id, title, title_sort_key, status, physical_path, meta_path,
      total_duration_sec, track_count, urls_json, playlists_json
    ) VALUES ('work', 'title', 'title', 'ok', '/library/work', '/library/work/mimimilli.json', 10, 1, '[]', '[]');
    INSERT INTO playlists (id, work_id, position, name) VALUES ('playlist', 'work', 0, 'default');
    INSERT INTO tracks (id, playlist_id, work_id, position, title, file) VALUES ('track', 'playlist', 'work', 0, 'track', 'track.wav');
  `);

  appendCatalogMigration(migrationsDir, "0011_robust_gauntlet");
  migrate(drizzle(sqlite), { migrationsFolder: migrationsDir });
  const playlistsJsonColumn = sqlite
    .query(`SELECT COUNT(*) AS count FROM pragma_table_info('works') WHERE name = 'playlists_json'`)
    .get() as { count: number };
  const relationCount = sqlite.query(`SELECT COUNT(*) AS count FROM tracks`).get() as {
    count: number;
  };
  assert.equal(playlistsJsonColumn.count, 0);
  assert.equal(relationCount.count, 0);
  sqlite.close();
});
