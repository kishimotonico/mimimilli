import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "bun:sqlite";

interface MigrationJournal {
  entries: Array<{ tag: string; when: number }>;
}

interface Migration {
  hash: string;
  sql: string[];
  when: number;
}

function suppressRollbackError(migrationError: unknown, rollbackError: unknown): void {
  if (migrationError === null || typeof migrationError !== "object") return;
  try {
    const error = migrationError as { suppressed?: unknown };
    const suppressed = Array.isArray(error.suppressed) ? error.suppressed : [];
    Object.defineProperty(error, "suppressed", {
      configurable: true,
      value: [...suppressed, rollbackError],
    });
  } catch {
    // 一次例外の保持を優先する。
  }
}

function readMigrations(migrationsFolder: string): Migration[] {
  const journalPath = join(migrationsFolder, "meta", "_journal.json");
  if (!existsSync(journalPath)) throw new Error("Can't find meta/_journal.json file");

  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as MigrationJournal;
  return journal.entries.map(({ tag, when }) => {
    const migrationPath = join(migrationsFolder, `${tag}.sql`);
    let source: string;
    try {
      source = readFileSync(migrationPath, "utf8");
    } catch {
      throw new Error(`No file ${migrationPath} found in ${migrationsFolder} folder`);
    }
    return {
      hash: createHash("sha256").update(source).digest("hex"),
      sql: source.split("--> statement-breakpoint"),
      when,
    };
  });
}

function readLatestMigrationTime(sqlite: Database): number | undefined {
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

function insertMigration(sqlite: Database, migration: Migration): void {
  sqlite.run("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", [
    migration.hash,
    migration.when,
  ]);
}

/** Drizzleのprepared statementを残さず、SQLite接続上でmigrationを実行する。 */
export function executeSqliteMigrations(sqlite: Database, migrationsFolder: string): void {
  const migrations = readMigrations(migrationsFolder);
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
      if (latestMigrationTime === undefined || latestMigrationTime < migration.when) {
        for (const statement of migration.sql) sqlite.exec(statement);
        insertMigration(sqlite, migration);
      }
    }
    sqlite.exec("COMMIT");
  } catch (error) {
    try {
      sqlite.exec("ROLLBACK");
    } catch (rollbackError) {
      suppressRollbackError(error, rollbackError);
    }
    throw error;
  }
}
