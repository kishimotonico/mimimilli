import { existsSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { formatError, getCategoryLogger } from "../../lib/logger.ts";
import { appendSuppressedError } from "../../lib/suppressedError.ts";

export interface DatabaseFileOperations {
  exists(path: string): boolean;
  rename(source: string, destination: string): void;
  remove(path: string): void;
}

const defaultFileOperations: DatabaseFileOperations = {
  exists: existsSync,
  rename: renameSync,
  remove: (path) => rmSync(path, { force: true }),
};

const dbLogger = getCategoryLogger("db");

const WAL_SHM_SUFFIXES = ["-wal", "-shm"] as const;

function uniqueSiblingPath(path: string, purpose: "candidate" | "rollback"): string {
  return join(dirname(path), `.${basename(path)}.${purpose}-${crypto.randomUUID()}`);
}

function moveWalShmFiles(
  sourcePath: string,
  destinationPath: string,
  operations: DatabaseFileOperations,
): string[] {
  const moved: string[] = [];
  for (const suffix of WAL_SHM_SUFFIXES) {
    const source = `${sourcePath}${suffix}`;
    if (operations.exists(source)) {
      operations.rename(source, `${destinationPath}${suffix}`);
      moved.push(suffix);
    }
  }
  return moved;
}

function restoreWalShmFiles(
  rollbackPath: string,
  path: string,
  suffixes: readonly string[],
  operations: DatabaseFileOperations,
): void {
  for (const suffix of suffixes) {
    operations.rename(`${rollbackPath}${suffix}`, `${path}${suffix}`);
  }
}

export function removeDatabaseFiles(
  path: string,
  operations: DatabaseFileOperations = defaultFileOperations,
): void {
  operations.remove(path);
  for (const suffix of WAL_SHM_SUFFIXES) operations.remove(`${path}${suffix}`);
}

function removeDatabaseFilesWithoutThrowing(
  path: string,
  operations: DatabaseFileOperations,
): void {
  try {
    removeDatabaseFiles(path, operations);
  } catch (error) {
    dbLogger.warn("入替失敗時のcleanupに失敗しました", {
      path,
      operation: "remove",
      ...formatError(error),
    });
  }
}

/** 候補DBを同一ディレクトリ内で入れ替え、失敗時は元DBを復元する。 */
export function replaceDatabaseWithCandidate(
  path: string,
  candidatePath: string,
  operations: DatabaseFileOperations = defaultFileOperations,
): void {
  const rollbackPath = uniqueSiblingPath(path, "rollback");
  let originalMoved = false;
  let movedWalShmFiles: string[] = [];

  try {
    operations.rename(path, rollbackPath);
    originalMoved = true;
    movedWalShmFiles = moveWalShmFiles(path, rollbackPath, operations);
    operations.rename(candidatePath, path);
  } catch (error) {
    let restored = false;
    try {
      if (originalMoved) {
        operations.rename(rollbackPath, path);
        restoreWalShmFiles(rollbackPath, path, movedWalShmFiles, operations);
        restored = true;
      }
    } catch (restoreError) {
      // 復元失敗時はrollback一式を復旧用に残し、一次例外(install失敗)を保持したまま投げる。
      appendSuppressedError(error, restoreError);
    } finally {
      removeDatabaseFilesWithoutThrowing(candidatePath, operations);
      if (restored) removeDatabaseFilesWithoutThrowing(rollbackPath, operations);
    }
    throw error;
  }

  try {
    removeDatabaseFiles(rollbackPath, operations);
  } catch (error) {
    // 入替自体は成功しているため、rollback一時ファイルのcleanup失敗で起動を失敗させない。
    dbLogger.warn("入替成功後のrollback一時ファイル削除に失敗しました", {
      rollbackPath,
      operation: "remove",
      ...formatError(error),
    });
  }
}

export function createDatabaseCandidatePath(path: string): string {
  return uniqueSiblingPath(path, "candidate");
}
