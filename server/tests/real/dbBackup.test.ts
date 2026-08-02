import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { openDb } from "../../src/adapters/real/db.ts";
import {
  copyDatabaseToBackup,
  DB_BACKUP_RETENTION_COUNT,
  hasPendingMigrations,
  moveDatabaseToBackup,
  purgeOldBackups,
  readAppliedMigrationCount,
  readMigrationJournalEntryCount,
} from "../../src/adapters/real/dbBackup.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

function countPreMigrationBackups(backupDir: string, kind: "catalog" | "user"): number {
  return readdirSync(backupDir).filter(
    (name) => name.startsWith(`${kind}-`) && name.endsWith("-pre-migration.sqlite"),
  ).length;
}

const USER_MIGRATIONS_DIR = join(import.meta.dir, "../../drizzle/user");

test("moveDatabaseToBackupはsqlite/wal/shmを退避し、元ファイルを残さない", (t) => {
  const directory = makeTestDirectory("db-backup-move");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "db", "catalog.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  writeFileSync(dbPath, "catalog");
  writeFileSync(`${dbPath}-wal`, "wal");
  writeFileSync(`${dbPath}-shm`, "shm");
  const backupDir = join(directory.path, "backup");

  const backupPath = moveDatabaseToBackup(dbPath, backupDir, "catalog", "version-mismatch");

  assert.ok(backupPath.includes("catalog-"));
  assert.ok(backupPath.includes("version-mismatch.sqlite"));
  assert.equal(existsSync(dbPath), false);
  assert.equal(existsSync(`${dbPath}-wal`), false);
  assert.equal(existsSync(`${dbPath}-shm`), false);
  assert.equal(readFileSync(backupPath, "utf-8"), "catalog");
  assert.equal(readFileSync(`${backupPath}-wal`, "utf-8"), "wal");
  assert.equal(readFileSync(`${backupPath}-shm`, "utf-8"), "shm");
});

test("copyDatabaseToBackupは元DBを残してコピーする", (t) => {
  const directory = makeTestDirectory("db-backup-copy");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "db", "user.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  writeFileSync(dbPath, "user");
  const backupDir = join(directory.path, "backup");

  const backupPath = copyDatabaseToBackup(dbPath, backupDir, "user");

  assert.ok(backupPath);
  assert.ok(backupPath!.includes("pre-migration.sqlite"));
  assert.equal(readFileSync(dbPath, "utf-8"), "user");
  assert.equal(readFileSync(backupPath!, "utf-8"), "user");
});

test("purgeOldBackupsはpre-migrationのみN世代を超えた分を削除する", (t) => {
  const directory = makeTestDirectory("db-backup-purge");
  t.after(directory.cleanup);
  const backupDir = join(directory.path, "backup");
  mkdirSync(backupDir, { recursive: true });
  const keep = DB_BACKUP_RETENTION_COUNT + 2;
  for (let i = 0; i < keep; i++) {
    const name = `catalog-2026-01-${String(i + 1).padStart(2, "0")}T00-00-00-pre-migration.sqlite`;
    writeFileSync(join(backupDir, name), `v${i}`);
  }

  purgeOldBackups(backupDir, "catalog");

  const remaining = readdirSync(backupDir).filter((name) => name.startsWith("catalog-"));
  assert.equal(remaining.length, DB_BACKUP_RETENTION_COUNT);
  assert.ok(!remaining.some((name) => name.includes("2026-01-01T")));
  assert.ok(!remaining.some((name) => name.includes("2026-01-02T")));
});

test("purgeOldBackupsは退避バックアップ(version-mismatch等)を削除しない", (t) => {
  const directory = makeTestDirectory("db-backup-purge-evacuation");
  t.after(directory.cleanup);
  const backupDir = join(directory.path, "backup");
  mkdirSync(backupDir, { recursive: true });
  for (let i = 0; i < DB_BACKUP_RETENTION_COUNT + 2; i++) {
    const name = `catalog-2026-02-${String(i + 1).padStart(2, "0")}T00-00-00-pre-migration.sqlite`;
    writeFileSync(join(backupDir, name), `pre-${i}`);
  }
  writeFileSync(
    join(backupDir, "catalog-2026-02-99T00-00-00-version-mismatch.sqlite"),
    "evacuated",
  );

  purgeOldBackups(backupDir, "catalog");

  const remaining = readdirSync(backupDir);
  assert.ok(
    remaining.some((name) => name.includes("version-mismatch")),
    "退避バックアップが残ること",
  );
  assert.equal(
    remaining.filter((name) => name.endsWith("-pre-migration.sqlite")).length,
    DB_BACKUP_RETENTION_COUNT,
  );
});

test("hasPendingMigrationsは__drizzle_migrations未存在を全件未適用として判定する", () => {
  const sqlite = new Database(":memory:");
  assert.equal(readAppliedMigrationCount(sqlite), 0);
  assert.equal(
    hasPendingMigrations(sqlite, USER_MIGRATIONS_DIR),
    readMigrationJournalEntryCount(USER_MIGRATIONS_DIR) > 0,
  );
  sqlite.close();
});

test("hasPendingMigrationsは適用済み件数がjournal件数以上ならfalse", (t) => {
  const directory = makeTestDirectory("db-pending-migrations");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "user.sqlite");
  const sqlite = new Database(dbPath, { create: true });
  migrate(drizzle(sqlite), { migrationsFolder: USER_MIGRATIONS_DIR });
  assert.equal(
    readAppliedMigrationCount(sqlite),
    readMigrationJournalEntryCount(USER_MIGRATIONS_DIR),
  );
  assert.equal(hasPendingMigrations(sqlite, USER_MIGRATIONS_DIR), false);
  sqlite.close();
});

test("スキーマ不一致時にバックアップ退避してからcatalogを再作成する", (t) => {
  const directory = makeTestDirectory("db-version-mismatch");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const backupDir = join(directory.path, "backup");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const sqlite = new Database(catalogPath, { create: true });
  sqlite.exec("PRAGMA user_version = 99");
  sqlite.close();

  openDb({ kind: "files", catalogPath, userPath }, { backupDir });

  const backups = readdirSync(backupDir).filter(
    (name) => name.startsWith("catalog-") && name.endsWith(".sqlite"),
  );
  assert.equal(backups.length, 1);
  assert.match(backups[0]!, /version-mismatch/);
  const reopened = new Database(catalogPath, { readonly: true });
  const version = reopened.query("PRAGMA user_version").get() as { user_version: number };
  assert.equal(version.user_version, 7);
  reopened.close();
});

test("user再作成時のcatalog-user非対称でcatalogを退避する", (t) => {
  const directory = makeTestDirectory("db-catalog-user-asymmetry");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const backupDir = join(directory.path, "backup");
  mkdirSync(join(directory.path, "db"), { recursive: true });

  const catalog = new Database(catalogPath, { create: true });
  catalog.exec("PRAGMA user_version = 7");
  catalog.close();

  const user = new Database(userPath, { create: true });
  user.exec("PRAGMA user_version = 99");
  user.close();

  openDb({ kind: "files", catalogPath, userPath }, { backupDir });

  const catalogBackups = readdirSync(backupDir).filter(
    (name) => name.startsWith("catalog-") && name.endsWith(".sqlite"),
  );
  const userBackups = readdirSync(backupDir).filter(
    (name) => name.startsWith("user-") && name.endsWith(".sqlite"),
  );
  assert.ok(catalogBackups.some((name) => name.includes("catalog-user-asymmetry")));
  assert.ok(userBackups.some((name) => name.includes("version-mismatch")));
});

test("初回起動(未適用マイグレーションあり)ではpre-migrationバックアップを作成する", (t) => {
  const directory = makeTestDirectory("db-pre-migration-backup");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const backupDir = join(directory.path, "backup");

  const db = openDb({ kind: "files", catalogPath, userPath }, { backupDir });
  db.close();

  const catalogBackups = countPreMigrationBackups(backupDir, "catalog");
  const userBackups = countPreMigrationBackups(backupDir, "user");
  assert.equal(catalogBackups, 1);
  assert.equal(userBackups, 1);
});

test("マイグレーション済みの再起動ではpre-migrationバックアップを増やさない", (t) => {
  const directory = makeTestDirectory("db-no-pre-migration-on-restart");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const backupDir = join(directory.path, "backup");
  const location = { kind: "files" as const, catalogPath, userPath };
  const options = { backupDir };

  openDb(location, options).close();
  const afterFirst =
    countPreMigrationBackups(backupDir, "catalog") + countPreMigrationBackups(backupDir, "user");
  openDb(location, options).close();
  const afterSecond =
    countPreMigrationBackups(backupDir, "catalog") + countPreMigrationBackups(backupDir, "user");

  assert.equal(afterSecond, afterFirst);
});
