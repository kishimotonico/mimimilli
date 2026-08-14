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

/** rename成功直後に呼び出し元所有の配列へ記録する。途中で例外が起きても部分進捗を失わない。 */
function moveWalShmFiles(
  sourcePath: string,
  destinationPath: string,
  operations: DatabaseFileOperations,
  moved: string[],
): void {
  for (const suffix of WAL_SHM_SUFFIXES) {
    const source = `${sourcePath}${suffix}`;
    if (operations.exists(source)) {
      operations.rename(source, `${destinationPath}${suffix}`);
      moved.push(suffix);
    }
  }
}

/**
 * rollback一式（本体+WAL/SHM）を通常pathへ復元する。途中失敗時は復元済み分を
 * best-effortでrollback側へ戻し、最終的に「全ファイルが通常path側」か
 * 「全ファイルがrollback側」のどちらかへ収束させる。戻すこと自体に失敗した
 * ファイルはpath側に取り残されるため、その旨を警告ログに残す。
 * 戻り値は復元が完全に成功したかどうか。
 */
function restoreOriginalDatabase(
  installError: unknown,
  rollbackPath: string,
  path: string,
  walShmSuffixes: readonly string[],
  operations: DatabaseFileOperations,
): boolean {
  const suffixes: readonly string[] = ["", ...walShmSuffixes];
  const restoredSuffixes: string[] = [];
  let restoreError: unknown;
  for (const suffix of suffixes) {
    try {
      operations.rename(`${rollbackPath}${suffix}`, `${path}${suffix}`);
      restoredSuffixes.push(suffix);
    } catch (error) {
      restoreError = error;
      break;
    }
  }
  if (restoreError === undefined) return true;
  appendSuppressedError(installError, restoreError);

  // 復元未到達分(restoredSuffixesに入らなかった分)はrollbackPathから動いていないため、そのまま保全対象。
  const preservedAtRollback = suffixes.filter((suffix) => !restoredSuffixes.includes(suffix));

  for (const suffix of restoredSuffixes.reverse()) {
    try {
      operations.rename(`${path}${suffix}`, `${rollbackPath}${suffix}`);
      preservedAtRollback.push(suffix);
    } catch (reEvacuationError) {
      appendSuppressedError(installError, reEvacuationError);
      dbLogger.warn(
        "復元失敗後の再退避に失敗し、DBファイルがrollback側と通常path側へ分断されました",
        {
          stuckAt: `${path}${suffix}`,
          expectedAt: `${rollbackPath}${suffix}`,
          operation: "rename",
          ...formatError(reEvacuationError),
        },
      );
    }
  }

  // 手動復旧用にrollback側の所在と、実際にそこへ揃ったファイルのみを構造化ログへ残す
  // (再退避に失敗した分はpath側に取り残るため、preservedSuffixesには含めない)。
  dbLogger.warn("入替に失敗しました。rollback一式を手動復旧用に残しています", {
    rollbackPath,
    preservedSuffixes: preservedAtRollback,
    operation: "preserve",
  });

  return false;
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
  const movedWalShmFiles: string[] = [];

  try {
    operations.rename(path, rollbackPath);
    originalMoved = true;
    moveWalShmFiles(path, rollbackPath, operations, movedWalShmFiles);
    operations.rename(candidatePath, path);
  } catch (error) {
    // 復元(再退避含む)の失敗はrollback一式を復旧用に残し、一次例外(install失敗)を保持したまま投げる。
    const restored = originalMoved
      ? restoreOriginalDatabase(error, rollbackPath, path, movedWalShmFiles, operations)
      : false;
    removeDatabaseFilesWithoutThrowing(candidatePath, operations);
    if (restored) removeDatabaseFilesWithoutThrowing(rollbackPath, operations);
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
