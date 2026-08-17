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
import { openDb } from "../../src/adapters/real/db.ts";
import {
  executeSqliteMigrations,
  hasPendingSqliteMigrations,
} from "../../src/adapters/real/sqliteMigrationExecutor.ts";
import {
  createDatabaseCandidatePath,
  replaceDatabaseWithCandidate,
} from "../../src/adapters/real/databaseReplacement.ts";
import {
  createDatabaseBackup,
  DB_BACKUP_RETENTION_COUNT,
  moveDatabaseToBackup,
  purgeOldBackups,
  verifyDatabaseBackup,
} from "../../src/adapters/real/dbBackup.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";
import { captureLogs, categoryRecords, recordMessage } from "../helpers/logCapture.ts";

function countPreMigrationBackups(backupDir: string, kind: "catalog" | "user"): number {
  return readdirSync(backupDir).filter(
    (name) => name.startsWith(`${kind}-`) && name.endsWith("-pre-migration.sqlite"),
  ).length;
}

function appliedMigrationCount(sqlite: Database): number {
  const statement = sqlite.query("SELECT COUNT(*) AS count FROM __drizzle_migrations");
  try {
    return (statement.get() as { count: number }).count;
  } finally {
    statement.finalize();
  }
}

function assertNoReplacementFiles(dbPath: string): void {
  const directory = dirname(dbPath);
  assert.equal(
    readdirSync(directory).some(
      (name) =>
        name.startsWith(`.${dbPath.split(/[\\/]/).at(-1)}.candidate-`) ||
        name.startsWith(`.${dbPath.split(/[\\/]/).at(-1)}.rollback-`),
    ),
    false,
  );
}

function findRollbackFileName(directory: string, part: "main" | "wal"): string | undefined {
  return readdirSync(directory).find((name) => {
    if (!name.includes(".rollback-")) return false;
    if (part === "wal") return name.endsWith("-wal");
    return !name.endsWith("-wal") && !name.endsWith("-shm");
  });
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
  assert.equal(
    snapshot.query<{ value: string }, []>("SELECT value FROM entries").get()?.value,
    "user",
  );
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

test("user DBのmigrationは候補除外テーブルを作成し、バックアップ検証の必須schemaに含める", (t) => {
  const directory = makeTestDirectory("db-backup-candidate-exclusions");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const db = openDb({ kind: "files", catalogPath, userPath });
  try {
    const table = db.sqlite
      .query(
        "SELECT name FROM user.sqlite_master WHERE type = 'table' AND name = 'scan_candidate_exclusions'",
      )
      .get();
    assert.ok(table);
  } finally {
    db.close();
  }
  const user = new Database(userPath);
  try {
    const backupPath = createDatabaseBackup(user, join(directory.path, "backup"), "user");
    assert.doesNotThrow(() => verifyDatabaseBackup(backupPath, "user"));
  } finally {
    user.close();
  }
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
  assert.equal(
    readdirSync(dirname(dbPath)).some((name) => name.startsWith(".user.sqlite.")),
    false,
  );
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
  assert.equal(
    readdirSync(dirname(dbPath)).some((name) => name.startsWith(".user.sqlite.")),
    false,
  );
});

test("候補DBのcleanup失敗はinstall失敗を上書きせず旧DBを復元する", (t) => {
  const directory = makeTestDirectory("db-candidate-cleanup-failure");
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
          if (path === candidatePath) throw new Error("candidate cleanup failed");
        },
      }),
    /candidate install failed/,
  );

  assert.equal(readFileSync(dbPath, "utf-8"), "old");
  assert.equal(readFileSync(`${dbPath}-wal`, "utf-8"), "old-wal");
  assertNoReplacementFiles(dbPath);
});

test("候補DBの復元失敗時はinstall失敗を一次例外として保持し、restore失敗はsuppressedへ積む", (t) => {
  const directory = makeTestDirectory("db-candidate-restore-failure");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "db", "user.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const candidatePath = createDatabaseCandidatePath(dbPath);
  writeFileSync(dbPath, "old");
  writeFileSync(`${dbPath}-wal`, "old-wal");
  writeFileSync(candidatePath, "new");

  let thrown: unknown;
  try {
    replaceDatabaseWithCandidate(dbPath, candidatePath, {
      exists: existsSync,
      rename(source, destination) {
        if (source === candidatePath && destination === dbPath) {
          throw new Error("candidate install failed");
        }
        if (source.includes(".rollback-") && destination === dbPath) {
          throw new Error("rollback restore failed");
        }
        renameSync(source, destination);
      },
      remove(path) {
        rmSync(path, { force: true });
      },
    });
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof Error);
  assert.match(thrown.message, /candidate install failed/);
  const suppressed = (thrown as Error & { suppressed?: unknown[] }).suppressed;
  assert.equal(suppressed?.length, 1);
  assert.match((suppressed![0] as Error).message, /rollback restore failed/);

  assert.equal(existsSync(dbPath), false);
  assert.equal(existsSync(candidatePath), false);
  const rollbackName = findRollbackFileName(dirname(dbPath), "main");
  assert.ok(rollbackName);
  const rollbackPath = join(dirname(dbPath), rollbackName);
  assert.equal(readFileSync(rollbackPath, "utf-8"), "old");
  assert.equal(readFileSync(`${rollbackPath}-wal`, "utf-8"), "old-wal");
});

test("本体復元成功後にsidecar復元が失敗しても、best-effortで一式をrollback側へ収束させる", (t) => {
  const directory = makeTestDirectory("db-candidate-sidecar-restore-failure");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "db", "user.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const candidatePath = createDatabaseCandidatePath(dbPath);
  writeFileSync(dbPath, "old");
  writeFileSync(`${dbPath}-wal`, "old-wal");
  writeFileSync(candidatePath, "new");

  let thrown: unknown;
  try {
    replaceDatabaseWithCandidate(dbPath, candidatePath, {
      exists: existsSync,
      rename(source, destination) {
        if (source === candidatePath && destination === dbPath) {
          throw new Error("candidate install failed");
        }
        if (
          source.endsWith("-wal") &&
          source.includes(".rollback-") &&
          destination === `${dbPath}-wal`
        ) {
          throw new Error("sidecar restore failed");
        }
        renameSync(source, destination);
      },
      remove(path) {
        rmSync(path, { force: true });
      },
    });
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof Error);
  assert.match(thrown.message, /candidate install failed/);
  const suppressed = (thrown as Error & { suppressed?: unknown[] }).suppressed;
  assert.equal(suppressed?.length, 1);
  assert.match((suppressed![0] as Error).message, /sidecar restore failed/);

  // 分断が残らない: 本体・WALのいずれも通常path側には存在せず、rollback側へ収束している。
  assert.equal(existsSync(dbPath), false);
  assert.equal(existsSync(`${dbPath}-wal`), false);
  assert.equal(existsSync(candidatePath), false);
  const rollbackName = findRollbackFileName(dirname(dbPath), "main");
  assert.ok(rollbackName);
  const rollbackPath = join(dirname(dbPath), rollbackName);
  assert.equal(readFileSync(rollbackPath, "utf-8"), "old");
  assert.equal(readFileSync(`${rollbackPath}-wal`, "utf-8"), "old-wal");
});

test("sidecar復元の再退避にも失敗した場合は両例外をsuppressedへ保持し、分断状態を警告ログへ残す", async (t) => {
  const directory = makeTestDirectory("db-candidate-sidecar-reevacuation-failure");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "db", "user.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const candidatePath = createDatabaseCandidatePath(dbPath);
  writeFileSync(dbPath, "old");
  writeFileSync(`${dbPath}-wal`, "old-wal");
  writeFileSync(candidatePath, "new");

  let thrown: unknown;
  // dbPathを起点とするrenameは「初回のrollback退避」と「再退避」の2回発生し、
  // source/destinationだけでは区別できないため出現回数で2回目のみ失敗させる。
  let dbPathRenameCount = 0;
  await captureLogs(
    async (records) => {
      try {
        replaceDatabaseWithCandidate(dbPath, candidatePath, {
          exists: existsSync,
          rename(source, destination) {
            if (source === candidatePath && destination === dbPath) {
              throw new Error("candidate install failed");
            }
            if (
              source.endsWith("-wal") &&
              source.includes(".rollback-") &&
              destination === `${dbPath}-wal`
            ) {
              throw new Error("sidecar restore failed");
            }
            if (source === dbPath) {
              dbPathRenameCount += 1;
              if (dbPathRenameCount === 2) throw new Error("re-evacuation failed");
            }
            renameSync(source, destination);
          },
          remove(path) {
            rmSync(path, { force: true });
          },
        });
      } catch (error) {
        thrown = error;
      }

      const warning = categoryRecords(records, "db").find(
        (record) =>
          recordMessage(record) ===
          "復元失敗後の再退避に失敗し、DBファイルがrollback側と通常path側へ分断されました",
      );
      assert.ok(warning);
      assert.equal(warning.properties.stuckAt, dbPath);

      // preservedSuffixesは実際にrollback側へ揃った分のみを指す。本体は再退避に失敗しpath側に
      // 取り残されているため、WALのみが挙がり本体("")は含まれない。
      const preserveWarning = categoryRecords(records, "db").find(
        (record) =>
          recordMessage(record) === "入替に失敗しました。rollback一式を手動復旧用に残しています",
      );
      assert.ok(preserveWarning);
      assert.deepEqual(preserveWarning.properties.preservedSuffixes, ["-wal"]);
    },
    { categories: ["db"] },
  );

  assert.ok(thrown instanceof Error);
  assert.match(thrown.message, /candidate install failed/);
  const suppressed = (thrown as Error & { suppressed?: unknown[] }).suppressed;
  assert.equal(suppressed?.length, 2);
  assert.match((suppressed![0] as Error).message, /sidecar restore failed/);
  assert.match((suppressed![1] as Error).message, /re-evacuation failed/);

  // 最終的な復旧対象の場所が判別できる: 本体はpath側に取り残され、WALはrollback側に残る。
  assert.equal(existsSync(dbPath), true);
  assert.equal(readFileSync(dbPath, "utf-8"), "old");
  assert.equal(existsSync(`${dbPath}-wal`), false);
  const rollbackWalName = findRollbackFileName(dirname(dbPath), "wal");
  assert.ok(rollbackWalName);
  assert.equal(readFileSync(join(dirname(dbPath), rollbackWalName), "utf-8"), "old-wal");
});

test("WAL退避成功後にSHM退避が失敗しても部分進捗を追跡し、rollback cleanupが元WALを削除しない", (t) => {
  const directory = makeTestDirectory("db-candidate-shm-evacuation-failure");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "db", "user.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const candidatePath = createDatabaseCandidatePath(dbPath);
  writeFileSync(dbPath, "old");
  writeFileSync(`${dbPath}-wal`, "old-wal");
  writeFileSync(`${dbPath}-shm`, "old-shm");
  writeFileSync(candidatePath, "new");

  let thrown: unknown;
  try {
    replaceDatabaseWithCandidate(dbPath, candidatePath, {
      exists: existsSync,
      rename(source, destination) {
        if (source === `${dbPath}-shm`) throw new Error("shm evacuation failed");
        renameSync(source, destination);
      },
      remove(path) {
        rmSync(path, { force: true });
      },
    });
  } catch (error) {
    thrown = error;
  }

  // SHM退避エラーが一次例外として伝播する(candidate installには到達しない)。
  assert.ok(thrown instanceof Error);
  assert.match(thrown.message, /shm evacuation failed/);

  // 本体・WALの両方が通常pathへ復元され、WALの内容が保全される(rollback cleanupで削除されない)。
  assert.equal(existsSync(dbPath), true);
  assert.equal(readFileSync(dbPath, "utf-8"), "old");
  assert.equal(existsSync(`${dbPath}-wal`), true);
  assert.equal(readFileSync(`${dbPath}-wal`, "utf-8"), "old-wal");

  // SHMは退避に失敗したため元の場所に残る。
  assert.equal(existsSync(`${dbPath}-shm`), true);
  assert.equal(readFileSync(`${dbPath}-shm`, "utf-8"), "old-shm");

  // 最終的に分断が残らない: candidate/rollback系の残骸がない。
  assertNoReplacementFiles(dbPath);
});

test("入替成功後のrollback一時ファイル削除失敗はbest-effortで処理され、入替自体は成功する", (t) => {
  const directory = makeTestDirectory("db-candidate-rollback-cleanup-failure");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "db", "user.sqlite");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const candidatePath = createDatabaseCandidatePath(dbPath);
  writeFileSync(dbPath, "old");
  writeFileSync(candidatePath, "new");

  assert.doesNotThrow(() =>
    replaceDatabaseWithCandidate(dbPath, candidatePath, {
      exists: existsSync,
      rename: renameSync,
      remove(path) {
        if (path.includes(".rollback-")) throw new Error("EBUSY: resource busy or locked");
        rmSync(path, { force: true });
      },
    }),
  );

  assert.equal(readFileSync(dbPath, "utf-8"), "new");
});

test("migration rollback失敗は元のmigration例外を保持する", () => {
  const migrationError = new Error("migration failed");
  const rollbackError = new Error("rollback failed");
  let executions = 0;
  const sqlite = {
    exec(sql: string) {
      if (sql === "ROLLBACK") throw rollbackError;
      if (sql !== "BEGIN" && executions++ > 0) throw migrationError;
    },
    query() {
      return {
        get: () => null,
        finalize() {},
        run() {},
      };
    },
  } as unknown as Database;

  let thrown: unknown;
  try {
    executeSqliteMigrations(sqlite, USER_MIGRATIONS_DIR);
  } catch (error) {
    thrown = error;
  }

  assert.equal(thrown, migrationError);
  assert.deepEqual((thrown as Error & { suppressed?: unknown[] }).suppressed, [rollbackError]);
});

test("Windows実ファイルで候補migration executorは成功後にDBを解放する", (t) => {
  const directory = makeTestDirectory("db-candidate-migration-executor-success");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "candidate.sqlite");
  const sqlite = new Database(dbPath, { create: true });

  executeSqliteMigrations(sqlite, USER_MIGRATIONS_DIR);
  sqlite.close();

  assert.doesNotThrow(() => rmSync(dbPath));
});

test("Windows実ファイルで候補migration executorは失敗後にもDBを解放する", (t) => {
  const directory = makeTestDirectory("db-candidate-migration-executor-failure");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "candidate.sqlite");
  const sqlite = new Database(dbPath, { create: true });
  sqlite.exec("CREATE TABLE app_settings (key TEXT PRIMARY KEY)");

  assert.throws(() => executeSqliteMigrations(sqlite, USER_MIGRATIONS_DIR), /already exists/);
  sqlite.close();

  assert.doesNotThrow(() => rmSync(dbPath));
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
  assert.equal(
    firstSnapshot.query<{ value: string }, []>("SELECT value FROM entries").get()?.value,
    "user-v1",
  );
  assert.equal(
    secondSnapshot.query<{ value: string }, []>("SELECT value FROM entries").get()?.value,
    "user-v2",
  );
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

test("hasPendingSqliteMigrationsは__drizzle_migrations未存在を全件未適用として判定する", () => {
  const sqlite = new Database(":memory:");
  assert.equal(hasPendingSqliteMigrations(sqlite, USER_MIGRATIONS_DIR), true);
  sqlite.close();
});

test("hasPendingSqliteMigrationsは全件適用済みならfalse", (t) => {
  const directory = makeTestDirectory("db-pending-migrations");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "user.sqlite");
  const sqlite = new Database(dbPath, { create: true });
  executeSqliteMigrations(sqlite, USER_MIGRATIONS_DIR);
  assert.equal(hasPendingSqliteMigrations(sqlite, USER_MIGRATIONS_DIR), false);
  sqlite.close();
});

test("hasPendingSqliteMigrationsは適用件数が足りていても最新created_atがjournalより古ければpendingとみなす", (t) => {
  const directory = makeTestDirectory("db-pending-stale-created-at");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "user.sqlite");
  const sqlite = new Database(dbPath, { create: true });
  executeSqliteMigrations(sqlite, USER_MIGRATIONS_DIR);
  assert.equal(hasPendingSqliteMigrations(sqlite, USER_MIGRATIONS_DIR), false);

  sqlite.exec("UPDATE __drizzle_migrations SET created_at = 0");

  assert.equal(hasPendingSqliteMigrations(sqlite, USER_MIGRATIONS_DIR), true);
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
  assert.equal(version.user_version, 9);
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
    7,
  );
  assert.equal(hasPendingSqliteMigrations(reopened, USER_MIGRATIONS_DIR), false);
  reopened.close();
});

test("Windows実ファイルのuser migration失敗時は候補をcloseして元の例外とDBを保持する", async (t) => {
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
      assert.throws(() => openDb(location, options), /already exists/);
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
  assert.equal(appliedMigrationCount(retained), 0);
  const workStatesStatement = retained.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'work_states'",
  );
  try {
    assert.ok(workStatesStatement.get());
  } finally {
    workStatesStatement.finalize();
  }
  retained.close();
  assert.equal(countPreMigrationBackups(backupDir, "user"), backupsBeforeFailure + 1);
  assertNoReplacementFiles(userPath);
});

test("Windows実ファイルのuser migration成功時は候補をcloseして入替後に残骸を残さない", (t) => {
  const directory = makeTestDirectory("db-user-migration-windows-file-replace");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");

  const db = openDb({ kind: "files", catalogPath, userPath });
  db.close();

  const user = new Database(userPath, { readonly: true });
  assert.equal(hasPendingSqliteMigrations(user, USER_MIGRATIONS_DIR), false);
  user.close();
  assertNoReplacementFiles(userPath);
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
