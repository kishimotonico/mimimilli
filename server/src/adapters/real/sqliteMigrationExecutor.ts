import type { Database } from "bun:sqlite";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import { appendSuppressedError } from "../../lib/suppressedError.ts";

function tableExists(sqlite: Database, name: string): boolean {
  const statement = sqlite.query(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?",
  );
  try {
    const row = statement.get(name) as { count: number } | null;
    return (row?.count ?? 0) > 0;
  } finally {
    statement.finalize();
  }
}

function readLatestMigrationTime(sqlite: Database): number | undefined {
  if (!tableExists(sqlite, "__drizzle_migrations")) return undefined;
  const statement = sqlite.query(
    "SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
  );
  try {
    const row = statement.get() as { created_at: number } | null;
    return row?.created_at;
  } finally {
    statement.finalize();
  }
}

function isMigrationPending(
  migration: MigrationMeta,
  latestMigrationTime: number | undefined,
): boolean {
  return latestMigrationTime === undefined || latestMigrationTime < migration.folderMillis;
}

function insertMigration(sqlite: Database, migration: MigrationMeta): void {
  sqlite.run("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", [
    migration.hash,
    migration.folderMillis,
  ]);
}

function isForeignKeysOff(statement: string): boolean {
  return /^PRAGMA\s+foreign_keys\s*=\s*OFF\s*;?$/i.test(statement.trim());
}

function isForeignKeysOn(statement: string): boolean {
  return /^PRAGMA\s+foreign_keys\s*=\s*ON\s*;?$/i.test(statement.trim());
}

function splitMigrationSql(sql: readonly string[]): {
  ddl: string[];
  disablesForeignKeys: boolean;
} {
  let start = 0;
  let end = sql.length;
  let disablesForeignKeys = false;
  if (sql.length > 0 && isForeignKeysOff(sql[0]!)) {
    disablesForeignKeys = true;
    start = 1;
  }
  if (end > start && isForeignKeysOn(sql[end - 1]!)) {
    end -= 1;
  }
  return { ddl: sql.slice(start, end), disablesForeignKeys };
}

function assertForeignKeyCheck(sqlite: Database): void {
  const violations = sqlite.query("PRAGMA foreign_key_check").all() as Array<{
    table: string;
    rowid: number;
    parent: string;
    fkid: number;
  }>;
  if (violations.length > 0) {
    const first = violations[0]!;
    throw new Error(
      `foreign_key_check が失敗しました: ${first.table} rowid=${first.rowid} parent=${first.parent}`,
    );
  }
}

function applyMigrationAtomically(
  sqlite: Database,
  migration: MigrationMeta,
  targetUserVersion: number,
): void {
  const { ddl, disablesForeignKeys } = splitMigrationSql(migration.sql);
  if (disablesForeignKeys) sqlite.exec("PRAGMA foreign_keys = OFF");
  sqlite.exec("BEGIN");
  try {
    for (const statement of ddl) sqlite.exec(statement);
    insertMigration(sqlite, migration);
    sqlite.exec(`PRAGMA user_version = ${targetUserVersion}`);
    if (disablesForeignKeys) assertForeignKeyCheck(sqlite);
    sqlite.exec("COMMIT");
  } catch (error) {
    try {
      sqlite.exec("ROLLBACK");
    } catch (rollbackError) {
      appendSuppressedError(error, rollbackError);
    }
    throw error;
  } finally {
    sqlite.exec("PRAGMA foreign_keys = ON");
  }
}

/** ledgerとjournalを比較し、未適用のmigrationがあるかを判定する。executeSqliteMigrationsと同一の判定基準を使う。 */
export function hasPendingSqliteMigrations(sqlite: Database, migrationsFolder: string): boolean {
  const migrations = readMigrationFiles({ migrationsFolder });
  const latestMigrationTime = readLatestMigrationTime(sqlite);
  return migrations.some((migration) => isMigrationPending(migration, latestMigrationTime));
}

/** DBがアプリより新しい場合は起動を失敗させる。 */
export function assertDatabaseNotNewerThanApp(
  sqlite: Database,
  migrationsFolder: string,
  targetUserVersion: number,
): void {
  const current = sqlite.query("PRAGMA user_version").get() as { user_version: number };
  if (current.user_version > targetUserVersion) {
    throw new Error(
      `DBのスキーマバージョンがアプリより新しいです（DB: v${current.user_version}, アプリ: v${targetUserVersion}）`,
    );
  }

  const migrations = readMigrationFiles({ migrationsFolder });
  const journalTimestamps = new Set(migrations.map((migration) => migration.folderMillis));
  const maxJournalTime = Math.max(...migrations.map((migration) => migration.folderMillis));
  if (!tableExists(sqlite, "__drizzle_migrations")) return;

  const rows = sqlite.query("SELECT created_at FROM __drizzle_migrations").all() as Array<{
    created_at: number;
  }>;
  for (const row of rows) {
    if (!journalTimestamps.has(row.created_at) && row.created_at > maxJournalTime) {
      throw new Error(`DBにアプリ未対応のmigration履歴があります（created_at: ${row.created_at}）`);
    }
  }
}

/** Drizzleのprepared statementを残さず、SQLite接続上でmigrationを実行する。 */
export function executeSqliteMigrations(
  sqlite: Database,
  migrationsFolder: string,
  targetUserVersion: number,
): void {
  const migrations = readMigrationFiles({ migrationsFolder });
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `);
  const latestMigrationTime = readLatestMigrationTime(sqlite);

  for (const migration of migrations) {
    if (isMigrationPending(migration, latestMigrationTime)) {
      applyMigrationAtomically(sqlite, migration, targetUserVersion);
    }
  }
}
