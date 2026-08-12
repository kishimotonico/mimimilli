import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { openDb } from "../../src/adapters/real/db.ts";
import {
  createDatabaseCandidatePath,
  replaceDatabaseWithCandidate,
} from "../../src/adapters/real/databaseReplacement.ts";
import {
  createDatabaseBackup,
  DB_BACKUP_RETENTION_COUNT,
  hasPendingMigrations,
  moveDatabaseToBackup,
  purgeOldBackups,
  readAppliedMigrationCount,
  readMigrationJournalEntryCount,
  verifyDatabaseBackup,
} from "../../src/adapters/real/dbBackup.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";
import { captureLogs, categoryRecords, recordMessage } from "../helpers/logCapture.ts";

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

test("createDatabaseBackupはWALを含むDBから一貫した論理スナップショットを作成する", (t) => {
  const directory = makeTestDirectory("db-backup-copy");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "db", "user.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const sqlite = new Database(dbPath, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("CREATE TABLE entries (value TEXT NOT NULL)");
  sqlite.run("INSERT INTO entries (value) VALUES (?)", ["user"]);
  const backupDir = join(directory.path, "backup");

  const backupPath = createDatabaseBackup(sqlite, backupDir, "user");
  sqlite.close();

  assert.ok(backupPath.includes("pre-migration.sqlite"));
  assert.equal(existsSync(`${backupPath}-wal`), false);
  verifyDatabaseBackup(backupPath, "user");
  const snapshot = new Database(backupPath, { readonly: true });
  assert.equal(snapshot.query("SELECT value FROM entries").get()?.value, "user");
  snapshot.close();
});

test("verifyDatabaseBackupはDB種別ごとの必須schemaを読み出す", (t) => {
  const directory = makeTestDirectory("db-backup-schema-read");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "user.sqlite");
  const sqlite = new Database(dbPath, { create: true });
  sqlite.exec("CREATE TABLE work_states (work_id TEXT PRIMARY KEY)");
  const backupPath = createDatabaseBackup(sqlite, join(directory.path, "backup"), "user");
  sqlite.close();

  assert.throws(() => verifyDatabaseBackup(backupPath, "user"), /必須テーブルがありません/);
});

test("候補DBは既存destinationを直接上書きせず同一ディレクトリで入れ替える", (t) => {
  const directory = makeTestDirectory("db-candidate-replace");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "db", "user.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const candidatePath = createDatabaseCandidatePath(dbPath);
  writeFileSync(dbPath, "old");
  writeFileSync(`${dbPath}-wal`, "old-wal");
  writeFileSync(candidatePath, "new");
  const destinations: string[] = [];

  replaceDatabaseWithCandidate(dbPath, candidatePath, {
    exists: existsSync,
    rename(source, destination) {
      if (source === candidatePath) {
        assert.equal(existsSync(destination), false, "candidateは空のdestinationへ置換する");
      }
      destinations.push(destination);
      renameSync(source, destination);
    },
    remove(path) {
      rmSync(path, { force: true });
    },
  });

  assert.equal(readFileSync(dbPath, "utf-8"), "new");
  assert.equal(existsSync(`${dbPath}-wal`), false);
  assert.ok(destinations.some((destination) => destination.includes(".rollback-")));
  assert.equal(readdirSync(dirname(dbPath)).some((name) => name.startsWith(".user.sqlite.")), false);
});

test("候補DBのinstall失敗時は旧DBを復元し一時ファイルを削除する", (t) => {
  const directory = makeTestDirectory("db-candidate-rollback");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "db", "user.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const candidatePath = createDatabaseCandidatePath(dbPath);
  writeFileSync(dbPath, "old");
  writeFileSync(`${dbPath}-wal`, "old-wal");
  writeFileSync(candidatePath, "new");

  assert.throws(
    () =>
      replaceDatabaseWithCandidate(dbPath, candidatePath, {
        exists: existsSync,
        rename(source, destination) {
          if (source === candidatePath && destination === dbPath) {
            throw new Error("candidate install failed");
          }
          renameSync(source, destination);
        },
        remove(path) {
          rmSync(path, { force: true });
        },
      }),
    /candidate install failed/,
  );

  assert.equal(readFileSync(dbPath, "utf-8"), "old");
  assert.equal(readFileSync(`${dbPath}-wal`, "utf-8"), "old-wal");
  assert.equal(existsSync(candidatePath), false);
  assert.equal(readdirSync(dirname(dbPath)).some((name) => name.startsWith(".user.sqlite.")), false);
});

test("createDatabaseBackupは同一タイムスタンプで衝突した場合に上書きせず連番サフィックスを付ける", (t) => {
  const directory = makeTestDirectory("db-backup-collision");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "db", "user.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const sqlite = new Database(dbPath, { create: true });
  sqlite.exec("CREATE TABLE entries (value TEXT NOT NULL)");
  sqlite.run("INSERT INTO entries (value) VALUES (?)", ["user-v1"]);
  const backupDir = join(directory.path, "backup");
  const fixedDate = new Date("2026-01-01T00:00:00.123Z");

  const first = createDatabaseBackup(sqlite, backupDir, "user", fixedDate);
  sqlite.run("UPDATE entries SET value = ?", ["user-v2"]);
  const second = createDatabaseBackup(sqlite, backupDir, "user", fixedDate);
  sqlite.close();

  assert.notEqual(first, second);
  const firstSnapshot = new Database(first, { readonly: true });
  const secondSnapshot = new Database(second, { readonly: true });
  assert.equal(firstSnapshot.query("SELECT value FROM entries").get()?.value, "user-v1");
  assert.equal(secondSnapshot.query("SELECT value FROM entries").get()?.value, "user-v2");
  firstSnapshot.close();
  secondSnapshot.close();
  assert.match(second!, /-1\.sqlite$/);
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

test("catalogはスキーマ不一致時にバックアップ退避してから再作成する", (t) => {
  const directory = makeTestDirectory("db-version-mismatch");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const backupDir = join(directory.path, "backup");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const sqlite = new Database(catalogPath, { create: true });
  sqlite.exec("PRAGMA user_version = 99");
  sqlite.close();

  openDb({ kind: "files", catalogPath, userPath }, { backupDir }).close();

  const backups = readdirSync(backupDir).filter(
    (name) =>
      name.startsWith("catalog-") && name.includes("version-mismatch") && name.endsWith(".sqlite"),
  );
  assert.equal(backups.length, 1);
  assert.match(backups[0]!, /version-mismatch/);
  const reopened = new Database(catalogPath, { readonly: true });
  const version = reopened.query("PRAGMA user_version").get() as { user_version: number };
  assert.equal(version.user_version, 7);
  reopened.close();
});

test("userはschema version不一致でも退避・再作成せずmigration journalで開く", (t) => {
  const directory = makeTestDirectory("db-user-version-mismatch");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const backupDir = join(directory.path, "backup");
  mkdirSync(join(directory.path, "db"), { recursive: true });

  openDb({ kind: "files", catalogPath, userPath }, { backupDir }).close();
  const user = new Database(userPath);
  user.exec("PRAGMA user_version = 99");
  user.close();

  openDb({ kind: "files", catalogPath, userPath }, { backupDir }).close();

  assert.equal(
    readdirSync(backupDir).some(
      (name) => name.includes("user-") && name.includes("version-mismatch"),
    ),
    false,
  );
  const reopened = new Database(userPath, { readonly: true });
  assert.equal(
    (reopened.query("PRAGMA user_version").get() as { user_version: number }).user_version,
    6,
  );
  assert.equal(
    readAppliedMigrationCount(reopened),
    readMigrationJournalEntryCount(USER_MIGRATIONS_DIR),
  );
  reopened.close();
});

test("user migration失敗時は元DBを保持して起動を停止する", async (t) => {
  const directory = makeTestDirectory("db-user-migration-failure");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const backupDir = join(directory.path, "backup");
  const location = { kind: "files" as const, catalogPath, userPath };
  const options = { backupDir };

  openDb(location, options).close();
  const backupsBeforeFailure = countPreMigrationBackups(backupDir, "user");
  const user = new Database(userPath);
  user.exec("DELETE FROM __drizzle_migrations");
  user.close();

  await captureLogs(
    async (records) => {
      assert.throws(() => openDb(location, options));
      const failure = categoryRecords(records, "db").find(
        (record) =>
          recordMessage(record) === "データベースのオープンに失敗しました" &&
          record.properties.kind === "user" &&
          record.properties.phase === "migrate",
      );
      assert.ok(failure);
      assert.equal(typeof failure.properties.message, "string");
    },
    { categories: ["db"] },
  );

  const retained = new Database(userPath, { readonly: true });
  assert.equal(readAppliedMigrationCount(retained), 0);
  assert.ok(
    retained
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'work_states'")
      .get(),
  );
  retained.close();
  assert.equal(countPreMigrationBackups(backupDir, "user"), backupsBeforeFailure + 1);
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
