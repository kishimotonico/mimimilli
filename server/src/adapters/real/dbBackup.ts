import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Database, type Database as DatabaseType } from "bun:sqlite";
import { getCategoryLogger } from "../../lib/logger.ts";

/** pre-migration バックアップの保持世代数。 */
export const DB_BACKUP_RETENTION_COUNT = 5;

export type DbBackupKind = "catalog" | "user";

const dbLogger = getCategoryLogger("db");

function formatBackupTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 23).replace(/:/g, "-").replace(".", "-");
}

function backupFileName(kind: DbBackupKind, date = new Date()): string {
  return `${kind}-${formatBackupTimestamp(date)}-pre-migration.sqlite`;
}

/** 既存バックアップと衝突しないパスを返す（上書きはしない）。 */
function resolveUniqueBackupPath(backupDir: string, kind: DbBackupKind, date = new Date()): string {
  const baseName = backupFileName(kind, date);
  let candidate = join(backupDir, baseName);
  if (!existsSync(candidate)) return candidate;
  const stem = baseName.slice(0, -".sqlite".length);
  for (let suffix = 1; ; suffix += 1) {
    candidate = join(backupDir, `${stem}-${suffix}.sqlite`);
    if (!existsSync(candidate)) return candidate;
  }
}

const DB_FILE_SUFFIXES = ["", "-wal", "-shm"] as const;

function isPreMigrationBackupFile(name: string, kind: DbBackupKind): boolean {
  return name.startsWith(`${kind}-`) && name.includes("-pre-migration");
}

function parsePreMigrationBackupOrder(
  name: string,
  kind: DbBackupKind,
): { timestamp: string; sequence: number } | null {
  const match = name.match(new RegExp(`^${kind}-(.+)-pre-migration(?:-(\\d+))?\\.sqlite$`));
  if (!match) return null;
  return { timestamp: match[1]!, sequence: match[2] ? Number.parseInt(match[2], 10) : 0 };
}

function sortPreMigrationBackups(names: readonly string[], kind: DbBackupKind): string[] {
  return names
    .map((name) => ({ name, order: parsePreMigrationBackupOrder(name, kind) }))
    .filter(
      (item): item is { name: string; order: { timestamp: string; sequence: number } } =>
        item.order !== null,
    )
    .sort((left, right) => {
      const timestampOrder = left.order.timestamp.localeCompare(right.order.timestamp);
      if (timestampOrder !== 0) return timestampOrder;
      return left.order.sequence - right.order.sequence;
    })
    .map((item) => item.name);
}

/** pre-migration バックアップのみ世代管理する。 */
export function purgeOldBackups(backupDir: string, kind: DbBackupKind): void {
  let entries: string[];
  try {
    entries = readdirSync(backupDir);
  } catch {
    return;
  }
  const sorted = sortPreMigrationBackups(
    entries.filter((name) => isPreMigrationBackupFile(name, kind)),
    kind,
  );
  for (const name of sorted.slice(0, Math.max(0, sorted.length - DB_BACKUP_RETENTION_COUNT))) {
    const base = name.slice(0, -".sqlite".length);
    for (const suffix of DB_FILE_SUFFIXES) {
      rmSync(join(backupDir, `${base}.sqlite${suffix === "" ? "" : suffix}`), { force: true });
    }
  }
}

/** 開いているDBの一貫した論理スナップショットを作成する。 */
export function createDatabaseBackup(
  sqlite: DatabaseType,
  backupDir: string,
  kind: DbBackupKind,
  date = new Date(),
): string {
  mkdirSync(backupDir, { recursive: true });
  const backupPath = resolveUniqueBackupPath(backupDir, kind, date);
  try {
    sqlite.run("VACUUM INTO ?", [backupPath]);
  } catch (error) {
    rmSync(backupPath, { force: true });
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

/** 論理スナップショットを独立接続で検査する。 */
export function verifyDatabaseBackup(backupPath: string): void {
  try {
    const backup = new Database(backupPath, { readonly: true });
    try {
      const integrity = backup.query("PRAGMA integrity_check").get() as {
        integrity_check: string;
      };
      if (integrity.integrity_check !== "ok") {
        throw new Error(`integrity_check が失敗しました: ${integrity.integrity_check}`);
      }
    } finally {
      backup.close();
    }
  } catch (error) {
    rmSync(backupPath, { force: true });
    throw error;
  }
}
