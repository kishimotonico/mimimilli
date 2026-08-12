import { existsSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

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

const SIDE_CAR_SUFFIXES = ["-wal", "-shm"] as const;

function uniqueSiblingPath(path: string, purpose: "candidate" | "rollback"): string {
  return join(dirname(path), `.${basename(path)}.${purpose}-${crypto.randomUUID()}`);
}

function moveSidecars(
  sourcePath: string,
  destinationPath: string,
  operations: DatabaseFileOperations,
): string[] {
  const moved: string[] = [];
  for (const suffix of SIDE_CAR_SUFFIXES) {
    const source = `${sourcePath}${suffix}`;
    if (operations.exists(source)) {
      operations.rename(source, `${destinationPath}${suffix}`);
      moved.push(suffix);
    }
  }
  return moved;
}

function restoreSidecars(
  rollbackPath: string,
  path: string,
  suffixes: readonly string[],
  operations: DatabaseFileOperations,
): void {
  for (const suffix of suffixes) {
    operations.rename(`${rollbackPath}${suffix}`, `${path}${suffix}`);
  }
}

function removeDatabaseFiles(path: string, operations: DatabaseFileOperations): void {
  operations.remove(path);
  for (const suffix of SIDE_CAR_SUFFIXES) operations.remove(`${path}${suffix}`);
}

/** 候補DBを同一ディレクトリ内で入れ替え、失敗時は元DBを復元する。 */
export function replaceDatabaseWithCandidate(
  path: string,
  candidatePath: string,
  operations: DatabaseFileOperations = defaultFileOperations,
): void {
  const rollbackPath = uniqueSiblingPath(path, "rollback");
  let originalMoved = false;
  let movedSidecars: string[] = [];

  try {
    operations.rename(path, rollbackPath);
    originalMoved = true;
    movedSidecars = moveSidecars(path, rollbackPath, operations);
    operations.rename(candidatePath, path);
  } catch (error) {
    let restored = false;
    try {
      if (originalMoved) {
        operations.rename(rollbackPath, path);
        restoreSidecars(rollbackPath, path, movedSidecars, operations);
      }
      restored = true;
    } finally {
      removeDatabaseFiles(candidatePath, operations);
      if (restored) removeDatabaseFiles(rollbackPath, operations);
    }
    throw error;
  }

  removeDatabaseFiles(rollbackPath, operations);
}

export function createDatabaseCandidatePath(path: string): string {
  return uniqueSiblingPath(path, "candidate");
}
