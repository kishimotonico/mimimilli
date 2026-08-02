import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import { getCategoryLogger } from "../../lib/logger.ts";

/** pre-migration バックアップの保持世代数。 */
export const DB_BACKUP_RETENTION_COUNT = 5;

export type DbBackupKind = "catalog" | "user";
export type DbBackupReason = "version-mismatch" | "catalog-user-asymmetry" | "pre-migration";

const dbLogger = getCategoryLogger("db");
const PRE_MIGRATION_SUFFIX = "-pre-migration.sqlite";

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

function transferDatabaseFiles(dbPath: string, backupPath: string, mode: "move" | "copy"): boolean {
  let transferred = false;
  for (const suffix of DB_FILE_SUFFIXES) {
    const source = `${dbPath}${suffix}`;
    if (!existsSync(source)) continue;
    const destination = `${backupPath}${suffix}`;
    if (mode === "move") {
      renameSync(source, destination);
    } else {
      copyFileSync(source, destination);
    }
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

export function readAppliedMigrationCount(sqlite: Database): number {
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

export function hasPendingMigrations(sqlite: Database, migrationsFolder: string): boolean {
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
  if (!transferDatabaseFiles(dbPath, backupPath, "move")) {
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

/** マイグレーション前にDB一式をコピーでバックアップする。DB未作成時は何もしない。 */
export function copyDatabaseToBackup(
  dbPath: string,
  backupDir: string,
  kind: DbBackupKind,
  date = new Date(),
): string | null {
  if (!existsSync(dbPath)) return null;
  mkdirSync(backupDir, { recursive: true });
  const backupPath = resolveUniqueBackupPath(backupDir, kind, "pre-migration", date);
  if (!transferDatabaseFiles(dbPath, backupPath, "copy")) {
    return null;
  }
  dbLogger.warn("マイグレーション前のDBバックアップを作成しました", {
    kind,
    reason: "pre-migration",
    dbPath,
    backupPath,
  });
  purgeOldBackups(backupDir, kind);
  return backupPath;
}
