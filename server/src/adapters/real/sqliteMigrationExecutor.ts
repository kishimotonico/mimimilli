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

function readLedgerTimes(sqlite: Database): number[] {
  if (!tableExists(sqlite, "__drizzle_migrations")) return [];
  const rows = sqlite.query("SELECT created_at FROM __drizzle_migrations").all() as Array<{
    created_at: number | string;
  }>;
  return rows.map((row) => Number(row.created_at));
}

/** ledgerとjournalを突き合わせ、未適用のmigrationを返す。履歴がjournalと整合しなければ例外を投げる。 */
function resolvePendingMigrations(
  sqlite: Database,
  migrations: readonly MigrationMeta[],
): MigrationMeta[] {
  const journalTimes = new Set(migrations.map((migration) => migration.folderMillis));
  const appliedTimes = new Set<number>();
  for (const time of readLedgerTimes(sqlite)) {
    if (!journalTimes.has(time)) {
      throw new Error(`DBにアプリ未対応のmigration履歴があります（created_at: ${time}）`);
    }
    if (appliedTimes.has(time)) {
      throw new Error(`DBのmigration履歴が重複しています（created_at: ${time}）`);
    }
    appliedTimes.add(time);
  }

  const pending = migrations.filter((migration) => !appliedTimes.has(migration.folderMillis));
  const latestApplied = Math.max(...appliedTimes);
  const gap = pending.find((migration) => migration.folderMillis < latestApplied);
  if (gap) {
    throw new Error(`DBのmigration履歴に欠けがあります（未適用: ${gap.folderMillis}）`);
  }
  return pending;
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

function applyMigrationAtomically(sqlite: Database, migration: MigrationMeta): void {
  const { ddl, disablesForeignKeys } = splitMigrationSql(migration.sql);
  if (disablesForeignKeys) sqlite.exec("PRAGMA foreign_keys = OFF");
  sqlite.exec("BEGIN");
  try {
    for (const statement of ddl) sqlite.exec(statement);
    insertMigration(sqlite, migration);
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

/** ledgerとjournalを比較し、未適用のmigrationがあるかを判定する。履歴がjournalと整合しなければ例外を投げる。 */
export function hasPendingSqliteMigrations(sqlite: Database, migrationsFolder: string): boolean {
  return resolvePendingMigrations(sqlite, readMigrationFiles({ migrationsFolder })).length > 0;
}

/** 履歴がjournalと整合しない（アプリより新しい等）DBは、書込みの前に起動を失敗させる。 */
export function assertMigrationHistoryConsistent(sqlite: Database, migrationsFolder: string): void {
  resolvePendingMigrations(sqlite, readMigrationFiles({ migrationsFolder }));
}

/** Drizzleのprepared statementを残さず、SQLite接続上でmigrationを実行する。 */
export function executeSqliteMigrations(
  sqlite: Database,
  migrationsFolder: string,
  onPendingMigration?: () => void,
): void {
  const migrations = readMigrationFiles({ migrationsFolder });
  const pending = resolvePendingMigrations(sqlite, migrations);
  if (pending.length === 0) return;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `);
  for (const migration of pending) {
    onPendingMigration?.();
    applyMigrationAtomically(sqlite, migration);
  }
}
