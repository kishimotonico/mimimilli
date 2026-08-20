import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { openDb } from "../../src/adapters/real/db.ts";
import {
  createDatabaseBackup,
  purgeOldBackups,
  verifyDatabaseBackup,
} from "../../src/adapters/real/dbBackup.ts";
import {
  assertDatabaseNotNewerThanApp,
  executeSqliteMigrations,
  hasPendingSqliteMigrations,
} from "../../src/adapters/real/sqliteMigrationExecutor.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";
import { captureLogs, categoryRecords, recordMessage } from "../helpers/logCapture.ts";

const USER_MIGRATIONS_DIR = join(import.meta.dir, "../../drizzle/user");
const CATALOG_MIGRATIONS_DIR = join(import.meta.dir, "../../drizzle/catalog");
const OPEN_DB_HARNESS = join(import.meta.dir, "helpers/openDbHarness.ts");

function countPreMigrationBackups(backupDir: string, kind: "catalog" | "user"): number {
  if (!existsSync(backupDir)) return 0;
  return readdirSync(backupDir).filter(
    (name) => name.startsWith(`${kind}-`) && name.includes("-pre-migration"),
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

function tableExists(sqlite: Database, name: string): boolean {
  const statement = sqlite.query(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?",
  );
  try {
    return ((statement.get(name) as { count: number } | null)?.count ?? 0) > 0;
  } finally {
    statement.finalize();
  }
}

function buildUserMigrationsDirThrough(destDir: string, lastTag: string): void {
  cpSync(USER_MIGRATIONS_DIR, destDir, { recursive: true });
  const journalPath = join(destDir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: Array<{ tag: string }>;
  };
  const lastIndex = journal.entries.findIndex((entry) => entry.tag === lastTag);
  assert.ok(lastIndex >= 0, `journal entry not found: ${lastTag}`);
  const excludedTags = journal.entries.slice(lastIndex + 1).map((entry) => entry.tag);
  for (const tag of excludedTags) {
    rmSync(join(destDir, `${tag}.sql`), { force: true });
    rmSync(join(destDir, "meta", `${tag.slice(0, 4)}_snapshot.json`), { force: true });
  }
  journal.entries = journal.entries.slice(0, lastIndex + 1);
  writeFileSync(journalPath, JSON.stringify(journal, null, 2));
}

function seedLegacyUserDb(userPath: string, migrationsDir: string): void {
  mkdirSync(join(userPath, ".."), { recursive: true });
  const sqlite = new Database(userPath, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL");
  migrate(drizzle(sqlite), { migrationsFolder: migrationsDir });
  sqlite.close();
}

test("AC1: user migration 0004までの旧スキーマはopenDbで0005まで適用され開ける", (t) => {
  const directory = makeTestDirectory("db-inplace-user-0004");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const backupDir = join(directory.path, "backup");
  const legacyMigrations = join(directory.path, "legacy-user-migrations");
  buildUserMigrationsDirThrough(legacyMigrations, "0004_sparkling_masked_marvel");
  seedLegacyUserDb(userPath, legacyMigrations);

  const legacy = new Database(userPath, { readonly: true });
  assert.equal(tableExists(legacy, "scan_candidate_exclusions"), false);
  assert.equal(hasPendingSqliteMigrations(legacy, USER_MIGRATIONS_DIR), true);
  legacy.close();

  const db = openDb({ kind: "files", catalogPath, userPath }, { backupDir });
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
});

test("AC2: migration途中kill後の再openは完了境界のいずれかの一貫状態になる", async (t) => {
  const directory = makeTestDirectory("db-inplace-kill");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const backupDir = join(directory.path, "backup");
  const legacyMigrations = join(directory.path, "legacy-user-migrations");
  buildUserMigrationsDirThrough(legacyMigrations, "0004_sparkling_masked_marvel");
  seedLegacyUserDb(userPath, legacyMigrations);

  openDb({ kind: "files", catalogPath, userPath }, { backupDir }).close();

  const proc = Bun.spawn(["bun", OPEN_DB_HARNESS, catalogPath, userPath, backupDir], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await Bun.sleep(30);
  proc.kill(9);
  await proc.exited;

  const reopened = new Database(userPath, { readonly: true });
  const migrationCount = appliedMigrationCount(reopened);
  const hasExclusions = tableExists(reopened, "scan_candidate_exclusions");
  reopened.close();

  assert.ok(migrationCount === 5 || migrationCount === 6);
  if (migrationCount === 5) assert.equal(hasExclusions, false);
  if (migrationCount === 6) assert.equal(hasExclusions, true);

  assert.doesNotThrow(() =>
    openDb({ kind: "files", catalogPath, userPath }, { backupDir }).close(),
  );
});

test("AC3: PRAGMA foreign_keysを含むmigrationはトランザクション外で適用され終了後にONへ戻る", (t) => {
  const directory = makeTestDirectory("db-inplace-fk-pragma");
  t.after(directory.cleanup);
  const migrationsDir = join(directory.path, "migrations");
  mkdirSync(join(migrationsDir, "meta"), { recursive: true });
  cpSync(
    join(CATALOG_MIGRATIONS_DIR, "0006_heavy_emma_frost.sql"),
    join(migrationsDir, "0006_heavy_emma_frost.sql"),
  );
  cpSync(
    join(CATALOG_MIGRATIONS_DIR, "meta", "0006_snapshot.json"),
    join(migrationsDir, "meta", "0006_snapshot.json"),
  );
  const folderMillis = JSON.parse(
    readFileSync(join(CATALOG_MIGRATIONS_DIR, "meta/_journal.json"), "utf-8"),
  ).entries.find((entry: { tag: string }) => entry.tag === "0006_heavy_emma_frost").when;
  writeFileSync(
    join(migrationsDir, "meta/_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "sqlite",
      entries: [
        {
          idx: 0,
          version: "6",
          when: folderMillis,
          tag: "0006_heavy_emma_frost",
          breakpoints: true,
        },
      ],
    }),
  );

  const dbPath = join(directory.path, "catalog.sqlite");
  const sqlite = new Database(dbPath, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE audio_probe_cache (
      path text PRIMARY KEY NOT NULL,
      size integer NOT NULL,
      mtime_ms integer NOT NULL,
      duration_sec real
    )
  `);
  sqlite.exec(
    `INSERT INTO audio_probe_cache (path, size, mtime_ms, duration_sec) VALUES ('/lib/ok.wav', 1, 1, 1.0)`,
  );
  executeSqliteMigrations(sqlite, migrationsDir, 9);
  const foreignKeys = sqlite.query("PRAGMA foreign_keys").get() as { foreign_keys: number };
  assert.equal(foreignKeys.foreign_keys, 1);
  sqlite.close();
});

test("AC3: FK違反データではforeign_key_checkによりmigrationが失敗する", (t) => {
  const directory = makeTestDirectory("db-inplace-fk-violation");
  t.after(directory.cleanup);
  const migrationsDir = join(directory.path, "migrations");
  mkdirSync(join(migrationsDir, "meta"), { recursive: true });
  writeFileSync(
    join(migrationsDir, "0000_bad.sql"),
    [
      "PRAGMA foreign_keys=OFF;",
      "CREATE TABLE parent (id INTEGER PRIMARY KEY);",
      "CREATE TABLE child (parent_id INTEGER REFERENCES parent(id));",
      "INSERT INTO child (parent_id) VALUES (1);",
      "PRAGMA foreign_keys=ON;",
    ].join("\n--> statement-breakpoint\n"),
  );
  writeFileSync(
    join(migrationsDir, "meta/_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "sqlite",
      entries: [
        {
          idx: 0,
          version: "6",
          when: 1,
          tag: "0000_bad",
          breakpoints: true,
        },
      ],
    }),
  );
  const sqlite = new Database(join(directory.path, "db.sqlite"), { create: true });
  assert.throws(
    () => executeSqliteMigrations(sqlite, migrationsDir, 1),
    /foreign_key_check が失敗しました/,
  );
  const foreignKeys = sqlite.query("PRAGMA foreign_keys").get() as { foreign_keys: number };
  assert.equal(foreignKeys.foreign_keys, 1);
  assert.equal(appliedMigrationCount(sqlite), 0);
  sqlite.close();
});

test("AC4: DBがアプリより新しい場合はバックアップもuser_version書換えもせずfail-fastする", (t) => {
  const directory = makeTestDirectory("db-inplace-newer-db");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const backupDir = join(directory.path, "backup");
  mkdirSync(join(directory.path, "db"), { recursive: true });
  const sqlite = new Database(userPath, { create: true });
  sqlite.exec("PRAGMA user_version = 99");
  sqlite.close();

  assert.throws(
    () => openDb({ kind: "files", catalogPath, userPath }, { backupDir }),
    /DBのスキーマバージョンがアプリより新しいです/,
  );
  assert.equal(existsSync(backupDir), false);
  const reopened = new Database(userPath, { readonly: true });
  assert.equal(
    (reopened.query("PRAGMA user_version").get() as { user_version: number }).user_version,
    99,
  );
  reopened.close();
});

test("AC4: journalにない新しいledgerエントリでもfail-fastする", (t) => {
  const directory = makeTestDirectory("db-inplace-unknown-ledger");
  t.after(directory.cleanup);
  const sqlite = new Database(join(directory.path, "user.sqlite"), { create: true });
  sqlite.exec(`
    CREATE TABLE __drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `);
  sqlite.run("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", [
    "future",
    Number.MAX_SAFE_INTEGER,
  ]);
  assert.throws(
    () => assertDatabaseNotNewerThanApp(sqlite, USER_MIGRATIONS_DIR, 7),
    /アプリ未対応のmigration履歴/,
  );
  sqlite.close();
});

test("AC5: migration失敗時は旧スキーマのまま起動失敗しpre-migrationバックアップが残る", async (t) => {
  const directory = makeTestDirectory("db-inplace-migration-failure");
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
    },
    { categories: ["db"] },
  );

  const retained = new Database(userPath, { readonly: true });
  assert.equal(appliedMigrationCount(retained), 0);
  assert.ok(tableExists(retained, "work_states"));
  retained.close();
  assert.equal(countPreMigrationBackups(backupDir, "user"), backupsBeforeFailure + 1);
  assert.doesNotThrow(() => rmSync(userPath));
});

test("AC5: VACUUM INTO失敗・検証NGの出力ファイルは残らない", (t) => {
  const directory = makeTestDirectory("db-inplace-backup-cleanup");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "user.sqlite");
  const backupDir = join(directory.path, "backup");
  mkdirSync(backupDir, { recursive: true });
  const sqlite = new Database(dbPath, { create: true });
  sqlite.exec("CREATE TABLE entries (value TEXT NOT NULL)");
  sqlite.run("INSERT INTO entries (value) VALUES (?)", ["broken"]);
  const backupPath = join(backupDir, "user-broken-pre-migration.sqlite");
  writeFileSync(backupPath, "not-a-database");

  assert.throws(() => verifyDatabaseBackup(backupPath));
  assert.equal(existsSync(backupPath), false);
  sqlite.close();
});

test("AC6: 新規DBではバックアップ・検証がスキップされる", (t) => {
  const directory = makeTestDirectory("db-inplace-new-db-skip-backup");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const backupDir = join(directory.path, "backup");

  openDb({ kind: "files", catalogPath, userPath }, { backupDir }).close();

  assert.equal(existsSync(backupDir), false);
});

test("AC6: purgeOldBackupsは連番付きも生成順で世代管理する", (t) => {
  const directory = makeTestDirectory("db-inplace-purge-sequence");
  t.after(directory.cleanup);
  const backupDir = join(directory.path, "backup");
  mkdirSync(backupDir, { recursive: true });
  const timestamp = "2026-03-01T00-00-00-000";
  const names = [
    `user-${timestamp}-pre-migration.sqlite`,
    `user-${timestamp}-pre-migration-1.sqlite`,
    `user-${timestamp}-pre-migration-2.sqlite`,
    `user-2026-03-02T00-00-00-000-pre-migration.sqlite`,
    `user-2026-03-03T00-00-00-000-pre-migration.sqlite`,
    `user-2026-03-04T00-00-00-000-pre-migration.sqlite`,
    `user-2026-03-05T00-00-00-000-pre-migration.sqlite`,
    `user-2026-03-06T00-00-00-000-pre-migration.sqlite`,
  ];
  for (const name of names) writeFileSync(join(backupDir, name), name);

  purgeOldBackups(backupDir, "user");

  const remaining = readdirSync(backupDir).sort();
  assert.deepEqual(remaining, [
    "user-2026-03-02T00-00-00-000-pre-migration.sqlite",
    "user-2026-03-03T00-00-00-000-pre-migration.sqlite",
    "user-2026-03-04T00-00-00-000-pre-migration.sqlite",
    "user-2026-03-05T00-00-00-000-pre-migration.sqlite",
    "user-2026-03-06T00-00-00-000-pre-migration.sqlite",
  ]);
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
  verifyDatabaseBackup(backupPath);
  const snapshot = new Database(backupPath, { readonly: true });
  assert.equal(
    snapshot.query<{ value: string }, []>("SELECT value FROM entries").get()?.value,
    "user",
  );
  snapshot.close();
});

test("verifyDatabaseBackupはintegrity_checkのみを検査する", (t) => {
  const directory = makeTestDirectory("db-backup-integrity-only");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "user.sqlite");
  const sqlite = new Database(dbPath, { create: true });
  sqlite.exec("CREATE TABLE work_states (work_id TEXT PRIMARY KEY)");
  const backupPath = createDatabaseBackup(sqlite, join(directory.path, "backup"), "user");
  sqlite.close();
  assert.doesNotThrow(() => verifyDatabaseBackup(backupPath));
});

test("migration rollback失敗は元のmigration例外を保持する", () => {
  const migrationError = new Error("migration failed");
  const rollbackError = new Error("rollback failed");
  let executions = 0;
  const sqlite = {
    exec(sql: string) {
      if (sql === "ROLLBACK") throw rollbackError;
      if (sql === "PRAGMA foreign_keys = ON") return;
      if (sql === "PRAGMA foreign_keys = OFF") return;
      if (sql !== "BEGIN" && executions++ > 0) throw migrationError;
    },
    query() {
      return {
        get: () => null,
        all: () => [],
        finalize() {},
        run() {},
      };
    },
    run() {},
  } as unknown as Database;

  let thrown: unknown;
  try {
    executeSqliteMigrations(sqlite, USER_MIGRATIONS_DIR, 7);
  } catch (error) {
    thrown = error;
  }

  assert.equal(thrown, migrationError);
  assert.deepEqual((thrown as Error & { suppressed?: unknown[] }).suppressed, [rollbackError]);
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
  assert.match(second, /-1\.sqlite$/);
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
  executeSqliteMigrations(sqlite, USER_MIGRATIONS_DIR, 7);
  assert.equal(hasPendingSqliteMigrations(sqlite, USER_MIGRATIONS_DIR), false);
  sqlite.close();
});

test("hasPendingSqliteMigrationsは適用件数が足りていても最新created_atがjournalより古ければpendingとみなす", (t) => {
  const directory = makeTestDirectory("db-pending-stale-created-at");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "user.sqlite");
  const sqlite = new Database(dbPath, { create: true });
  executeSqliteMigrations(sqlite, USER_MIGRATIONS_DIR, 7);
  assert.equal(hasPendingSqliteMigrations(sqlite, USER_MIGRATIONS_DIR), false);

  sqlite.exec("UPDATE __drizzle_migrations SET created_at = 0");

  assert.equal(hasPendingSqliteMigrations(sqlite, USER_MIGRATIONS_DIR), true);
  sqlite.close();
});

test("マイグレーション済みの再起動ではpre-migrationバックアップを増やさない", (t) => {
  const directory = makeTestDirectory("db-no-pre-migration-on-restart");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const backupDir = join(directory.path, "backup");
  const legacyMigrations = join(directory.path, "legacy-user-migrations");
  buildUserMigrationsDirThrough(legacyMigrations, "0004_sparkling_masked_marvel");
  seedLegacyUserDb(userPath, legacyMigrations);
  const location = { kind: "files" as const, catalogPath, userPath };
  const options = { backupDir };

  openDb(location, options).close();
  const afterFirst =
    countPreMigrationBackups(backupDir, "catalog") + countPreMigrationBackups(backupDir, "user");
  openDb(location, options).close();
  const afterSecond =
    countPreMigrationBackups(backupDir, "catalog") + countPreMigrationBackups(backupDir, "user");

  assert.equal(afterSecond, afterFirst);
  assert.equal(afterFirst, 1);
});

test("既存データを持つDBで初回migration時のみpre-migrationバックアップを作成する", (t) => {
  const directory = makeTestDirectory("db-pre-migration-backup-existing");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "db", "catalog.sqlite");
  const userPath = join(directory.path, "db", "user.sqlite");
  const backupDir = join(directory.path, "backup");
  const legacyMigrations = join(directory.path, "legacy-user-migrations");
  buildUserMigrationsDirThrough(legacyMigrations, "0004_sparkling_masked_marvel");
  seedLegacyUserDb(userPath, legacyMigrations);

  openDb({ kind: "files", catalogPath, userPath }, { backupDir }).close();

  assert.equal(countPreMigrationBackups(backupDir, "catalog"), 0);
  assert.equal(countPreMigrationBackups(backupDir, "user"), 1);
});

test("Windows実ファイルでmigration executorは成功後にDBを解放する", (t) => {
  const directory = makeTestDirectory("db-migration-executor-success");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "user.sqlite");
  const sqlite = new Database(dbPath, { create: true });

  executeSqliteMigrations(sqlite, USER_MIGRATIONS_DIR, 7);
  sqlite.close();

  assert.doesNotThrow(() => rmSync(dbPath));
});

test("Windows実ファイルでmigration executorは失敗後にもDBを解放する", (t) => {
  const directory = makeTestDirectory("db-migration-executor-failure");
  t.after(directory.cleanup);
  const dbPath = join(directory.path, "user.sqlite");
  const sqlite = new Database(dbPath, { create: true });
  sqlite.exec("CREATE TABLE app_settings (key TEXT PRIMARY KEY)");

  assert.throws(() => executeSqliteMigrations(sqlite, USER_MIGRATIONS_DIR, 7), /already exists/);
  sqlite.close();

  assert.doesNotThrow(() => rmSync(dbPath));
});
