import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";
import { openDb } from "../../src/adapters/real/db.ts";
import { appSettings, persistenceMeta, workStates } from "../../src/adapters/real/userSchema.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

function createLegacyDb(legacyPath: string): void {
  const legacy = new Database(legacyPath, { create: true });
  legacy.exec(`
    CREATE TABLE works (
      id TEXT PRIMARY KEY, added_at TEXT NOT NULL, bookmarked INTEGER NOT NULL,
      last_played_at TEXT, resume_position REAL NOT NULL, resume_track_index INTEGER NOT NULL
    );
    CREATE TABLE tag_prefixes (
      id INTEGER PRIMARY KEY, prefix TEXT, label TEXT, color TEXT,
      show_as_axis INTEGER, protected INTEGER
    );
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE search_presets (
      id INTEGER PRIMARY KEY, name TEXT, query TEXT, tag_filters_json TEXT, sort_id TEXT
    );
    CREATE TABLE smart_folders (
      id TEXT PRIMARY KEY, name TEXT, rules_json TEXT, sort TEXT, created_at TEXT
    );
    INSERT INTO works VALUES (
      'legacy-work', '2026-01-02T03:04:05.000Z', 1,
      '2026-02-03T04:05:06.000Z', 42.5, 3
    );
    INSERT INTO tag_prefixes VALUES (7, '気分', '気分', NULL, 1, 0);
    INSERT INTO app_settings VALUES ('root_folder', '/legacy/library');
    INSERT INTO app_settings VALUES ('last_scan_time', '2026-07-01T00:00:00.000Z');
    INSERT INTO search_presets VALUES (5, '旧プリセット', '声', '[]', 'title-asc');
    INSERT INTO smart_folders VALUES (
      'sf-legacy', '旧フォルダー', '[]', 'added-desc', '2026-01-01T00:00:00.000Z'
    );
  `);
  legacy.close();
}

test("旧単一DBを検出するとuser所有データを移し、旧DBを残す", (t) => {
  const directory = makeTestDirectory("legacy-db");
  t.after(directory.cleanup);
  const legacyPath = join(directory.path, "mimimilli.db");
  createLegacyDb(legacyPath);

  const db = openDb({
    kind: "files",
    catalogPath: join(directory.path, "db", "catalog.sqlite"),
    userPath: join(directory.path, "db", "user.sqlite"),
    legacyPath,
  });
  const state = db.user.select().from(workStates).where(eq(workStates.workId, "legacy-work")).get();
  assert.deepEqual(state, {
    workId: "legacy-work",
    addedAt: "2026-01-02T03:04:05.000Z",
    bookmarked: true,
    lastPlayedAt: "2026-02-03T04:05:06.000Z",
    resumePosition: 42.5,
    resumeTrackIndex: 3,
  });
  assert.equal(
    db.user.select().from(appSettings).where(eq(appSettings.key, "root_folder")).get()?.value,
    "/legacy/library",
  );
  assert.equal(
    db.user.select().from(appSettings).where(eq(appSettings.key, "last_scan_time")).get(),
    undefined,
  );
  assert.equal(
    (db.sqlite.query("SELECT name FROM user.search_presets WHERE id = 5").get() as { name: string })
      .name,
    "旧プリセット",
  );
  assert.equal(db.user.select().from(persistenceMeta).get()?.value, legacyPath);
  assert.ok(existsSync(legacyPath));
  db.close();
});

test("移行中断でマーカーのないuser DBが残っても、再起動時に冪等に移行を完遂する", (t) => {
  const directory = makeTestDirectory("legacy-db-resume");
  t.after(directory.cleanup);
  const legacyPath = join(directory.path, "mimimilli.db");
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  createLegacyDb(legacyPath);

  // 強制終了でトランザクションが完了しなかった状態を再現する。
  // user DBと一部の行は存在するが、完了マーカーはない。
  const interrupted = openDb({ kind: "files", catalogPath, userPath });
  interrupted.user
    .insert(workStates)
    .values({
      workId: "legacy-work",
      addedAt: "wrong",
      bookmarked: false,
      lastPlayedAt: null,
      resumePosition: 0,
      resumeTrackIndex: 0,
    })
    .run();
  interrupted.user.insert(appSettings).values({ key: "root_folder", value: "/wrong" }).run();
  assert.equal(interrupted.user.select().from(persistenceMeta).get(), undefined);
  interrupted.close();

  const resumed = openDb({ kind: "files", catalogPath, userPath, legacyPath });
  assert.deepEqual(
    resumed.user.select().from(workStates).where(eq(workStates.workId, "legacy-work")).get(),
    {
      workId: "legacy-work",
      addedAt: "2026-01-02T03:04:05.000Z",
      bookmarked: true,
      lastPlayedAt: "2026-02-03T04:05:06.000Z",
      resumePosition: 42.5,
      resumeTrackIndex: 3,
    },
  );
  assert.equal(
    resumed.user.select().from(appSettings).where(eq(appSettings.key, "root_folder")).get()?.value,
    "/legacy/library",
  );
  assert.equal(resumed.user.select().from(persistenceMeta).get()?.value, legacyPath);
  resumed.close();

  // 完了後の再起動では再コピーせず、重複も起きない。
  const reopened = openDb({ kind: "files", catalogPath, userPath, legacyPath });
  assert.equal(reopened.user.select().from(workStates).all().length, 1);
  assert.equal(reopened.user.select().from(persistenceMeta).all().length, 1);
  reopened.close();
});
