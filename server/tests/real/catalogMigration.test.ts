import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Database } from "bun:sqlite";
import { openDb } from "../../src/adapters/real/db.ts";
import {
  executeSqliteMigrations,
  hasPendingSqliteMigrations,
} from "../../src/adapters/real/sqliteMigrationExecutor.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

const CATALOG_MIGRATIONS_DIR = join(import.meta.dir, "../../drizzle/catalog");
const LATEST_MIGRATION_TAG = "0014_unreadable_paths";

function tableExists(sqlite: Database, name: string): boolean {
  const row = sqlite
    .query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { count: number };
  return row.count > 0;
}

function buildMigrationsDirWithout(destDir: string, tag: string): void {
  cpSync(CATALOG_MIGRATIONS_DIR, destDir, { recursive: true });
  rmSync(join(destDir, `${tag}.sql`));
  rmSync(join(destDir, "meta", `${tag.slice(0, 4)}_snapshot.json`));
  const journalPath = join(destDir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: Array<{ tag: string }>;
  };
  journal.entries = journal.entries.filter((entry) => entry.tag !== tag);
  writeFileSync(journalPath, JSON.stringify(journal, null, 2));
}

test("unreadable_paths: 新規DBはopenDbでテーブルが作られる", (t) => {
  const directory = makeTestDirectory("catalog-migration-fresh");
  t.after(directory.cleanup);
  const db = directory.own(
    openDb({
      kind: "files",
      catalogPath: join(directory.path, "db", "catalog.sqlite"),
      userPath: join(directory.path, "db", "user.sqlite"),
    }),
  );

  assert.equal(tableExists(db.sqlite, "invalid_meta_files"), true);
  assert.equal(tableExists(db.sqlite, "unreadable_paths"), true);
});

test("unreadable_paths: 0013まで適用済みの既存DBはpendingと判定され、openDbでテーブルが足されデータは保たれる", (t) => {
  const directory = makeTestDirectory("catalog-migration-existing");
  t.after(directory.cleanup);
  const previousDir = join(directory.path, "previous-migrations");
  buildMigrationsDirWithout(previousDir, LATEST_MIGRATION_TAG);

  const dbDir = join(directory.path, "db");
  mkdirSync(dbDir, { recursive: true });
  const catalogPath = join(dbDir, "catalog.sqlite");
  const legacy = new Database(catalogPath, { create: true });
  executeSqliteMigrations(legacy, previousDir);
  legacy.exec(
    `INSERT INTO identity_conflicts (work_id, path) VALUES ('work', 'copy-a'), ('work', 'copy-b')`,
  );
  assert.equal(tableExists(legacy, "unreadable_paths"), false);
  assert.equal(hasPendingSqliteMigrations(legacy, CATALOG_MIGRATIONS_DIR), true);
  legacy.close();

  const db = directory.own(
    openDb({ kind: "files", catalogPath, userPath: join(dbDir, "user.sqlite") }),
  );

  assert.equal(tableExists(db.sqlite, "invalid_meta_files"), true);
  assert.equal(tableExists(db.sqlite, "unreadable_paths"), true);
  assert.equal(hasPendingSqliteMigrations(db.sqlite, CATALOG_MIGRATIONS_DIR), false);
  const conflicts = db.sqlite.query("SELECT COUNT(*) AS count FROM identity_conflicts").get() as {
    count: number;
  };
  assert.equal(conflicts.count, 2);
  const backups = join(directory.path, "backup");
  assert.equal(existsSync(backups) && readdirSync(backups).length > 0, true);
});
