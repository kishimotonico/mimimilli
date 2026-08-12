import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Database, type Database as DatabaseType } from "bun:sqlite";
import { getCategoryLogger } from "../../lib/logger.ts";

/** pre-migration バックアップの保持世代数。 */
export const DB_BACKUP_RETENTION_COUNT = 5;

export type DbBackupKind = "catalog" | "user";
export type DbBackupReason = "version-mismatch" | "pre-migration";

const dbLogger = getCategoryLogger("db");
const PRE_MIGRATION_SUFFIX = "-pre-migration.sqlite";
const REQUIRED_TABLES: Record<DbBackupKind, readonly string[]> = {
  catalog: [
    "works",
    "playlists",
    "tracks",
    "tags",
    "work_tags",
    "work_dlsite",
    "scan_state",
    "audio_probe_cache",
  ],
  user: [
    "work_states",
    "tag_prefixes",
    "app_settings",
    "smart_folders",
    "scan_candidate_exclusions",
  ],
};

function formatBackupTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 23).replace(/:/g, "-").replace(".", "-");
}

function backupFileName(kind: DbBackupKind, reason: DbBackupReason, date = new Date()): string {
  return `${kind}-${formatBackupTimestamp(date)}-${reason}.sqlite`;
}

/** 既存バックアップと衝突しないパスを返す（上書きはしない）。 */
function resolveUniqueBackupPath(
  backupDir: string,
  kind: DbBackupKind,
  reason: DbBackupReason,
  date = new Date(),
): string {
  const baseName = backupFileName(kind, reason, date);
  let candidate = join(backupDir, baseName);
  if (!existsSync(candidate)) return candidate;
  const stem = baseName.slice(0, -".sqlite".length);
  for (let suffix = 1; ; suffix += 1) {
    candidate = join(backupDir, `${stem}-${suffix}.sqlite`);
    if (!existsSync(candidate)) return candidate;
  }
}

const DB_FILE_SUFFIXES = ["", "-wal", "-shm"] as const;

function moveDatabaseFiles(dbPath: string, backupPath: string): boolean {
  let transferred = false;
  for (const suffix of DB_FILE_SUFFIXES) {
    const source = `${dbPath}${suffix}`;
    if (!existsSync(source)) continue;
    const destination = `${backupPath}${suffix}`;
    renameSync(source, destination);
    transferred = true;
  }
  return transferred;
}

function isPreMigrationBackupFile(name: string, kind: DbBackupKind): boolean {
  return name.startsWith(`${kind}-`) && name.endsWith(PRE_MIGRATION_SUFFIX);
}

/** pre-migration バックアップのみ世代管理する。退避バックアップは削除しない。 */
export function purgeOldBackups(backupDir: string, kind: DbBackupKind): void {
  let entries: string[];
  try {
    entries = readdirSync(backupDir);
  } catch {
    return;
  }
  const mainFiles = entries
    .filter((name) => isPreMigrationBackupFile(name, kind))
    .sort()
    .reverse();
  for (const name of mainFiles.slice(DB_BACKUP_RETENTION_COUNT)) {
    const base = name.slice(0, -".sqlite".length);
    for (const suffix of DB_FILE_SUFFIXES) {
      rmSync(join(backupDir, `${base}.sqlite${suffix === "" ? "" : suffix}`), { force: true });
    }
  }
}

export function readMigrationJournalEntryCount(migrationsFolder: string): number {
  const journalPath = join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as { entries: unknown[] };
  return journal.entries.length;
}

export function readAppliedMigrationCount(sqlite: DatabaseType): number {
  const table = sqlite
    .query(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
    )
    .get() as { count: number };
  if (table.count === 0) return 0;
  const row = sqlite.query("SELECT COUNT(*) AS count FROM __drizzle_migrations").get() as {
    count: number;
  };
  return row.count;
}

export function hasPendingMigrations(sqlite: DatabaseType, migrationsFolder: string): boolean {
  return readAppliedMigrationCount(sqlite) < readMigrationJournalEntryCount(migrationsFolder);
}

/** 既存DB一式をバックアップへ移動する。失敗時は例外を投げる。 */
export function moveDatabaseToBackup(
  dbPath: string,
  backupDir: string,
  kind: DbBackupKind,
  reason: DbBackupReason,
  date = new Date(),
): string {
  mkdirSync(backupDir, { recursive: true });
  const backupPath = resolveUniqueBackupPath(backupDir, kind, reason, date);
  if (!moveDatabaseFiles(dbPath, backupPath)) {
    throw new Error(`バックアップ対象のDBファイルが見つかりません: ${dbPath}`);
  }
  dbLogger.error("DBファイルをバックアップへ退避しました", {
    kind,
    reason,
    dbPath,
    backupPath,
  });
  return backupPath;
}

/** 開いているDBの一貫した論理スナップショットを作成する。 */
export function createDatabaseBackup(
  sqlite: DatabaseType,
  backupDir: string,
  kind: DbBackupKind,
  date = new Date(),
): string {
  mkdirSync(backupDir, { recursive: true });
  const backupPath = resolveUniqueBackupPath(backupDir, kind, "pre-migration", date);
  try {
    sqlite.run("VACUUM INTO ?", [backupPath]);
  } catch (error) {
    throw new Error(`マイグレーション前バックアップの作成に失敗しました: ${backupPath}`, {
      cause: error,
    });
  }
  dbLogger.warn("マイグレーション前のDBバックアップを作成しました", {
    kind,
    reason: "pre-migration",
    dbPath: sqlite.filename,
    backupPath,
  });
  return backupPath;
}

/** 論理スナップショットを独立接続で検査し、DB種別ごとの現行schemaを読み出す。 */
export function verifyDatabaseBackup(backupPath: string, kind: DbBackupKind): void {
  const backup = new Database(backupPath, { readonly: true });
  try {
    const integrity = backup.query("PRAGMA integrity_check").get() as { integrity_check: string };
    if (integrity.integrity_check !== "ok") {
      throw new Error(`integrity_check が失敗しました: ${integrity.integrity_check}`);
    }
    const tableRows = backup
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>;
    const tables = new Set(tableRows.map(({ name }) => name));
    const requiredTables = REQUIRED_TABLES[kind];
    if (requiredTables.some((table) => tables.has(table))) {
      for (const table of requiredTables) {
        if (!tables.has(table)) {
          throw new Error(`必須テーブルがありません: ${table}`);
        }
        backup.query(`SELECT * FROM "${table}" LIMIT 1`).all();
      }
    }
  } finally {
    backup.close();
  }
}
