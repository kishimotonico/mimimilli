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

/** ledgerとjournalを比較し、未適用のmigrationがあるかを判定する。executeSqliteMigrationsと同一の判定基準を使う。 */
export function hasPendingSqliteMigrations(sqlite: Database, migrationsFolder: string): boolean {
  const migrations = readMigrationFiles({ migrationsFolder });
  const latestMigrationTime = readLatestMigrationTime(sqlite);
  return migrations.some((migration) => isMigrationPending(migration, latestMigrationTime));
}

/** Drizzleのprepared statementを残さず、SQLite接続上でmigrationを実行する。 */
export function executeSqliteMigrations(sqlite: Database, migrationsFolder: string): void {
  const migrations = readMigrationFiles({ migrationsFolder });
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `);
  const latestMigrationTime = readLatestMigrationTime(sqlite);

  sqlite.exec("BEGIN");
  try {
    for (const migration of migrations) {
      if (isMigrationPending(migration, latestMigrationTime)) {
        for (const statement of migration.sql) sqlite.exec(statement);
        insertMigration(sqlite, migration);
      }
    }
    sqlite.exec("COMMIT");
  } catch (error) {
    try {
      sqlite.exec("ROLLBACK");
    } catch (rollbackError) {
      appendSuppressedError(error, rollbackError);
    }
    throw error;
  }
}
