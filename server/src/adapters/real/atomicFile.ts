// 同一ディレクトリの一時ファイル（wx）→ fsync → rename による原子的なファイル置換。
import {
  closeSync,
  lstatSync,
  fsyncSync,
  openSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

export interface AtomicReplaceOps {
  exists(path: string): boolean;
  rename(from: string, to: string): void;
  unlink(path: string): void;
}

export function replaceWithRollback(
  filePath: string,
  tmp: string,
  rollback: string,
  ops: AtomicReplaceOps,
): boolean {
  try {
    ops.rename(tmp, filePath);
    return false;
  } catch (installError) {
    if (!ops.exists(filePath)) throw installError;
    ops.rename(filePath, rollback);
    try {
      ops.rename(tmp, filePath);
    } catch (replaceError) {
      try {
        ops.rename(rollback, filePath);
      } catch (restoreError) {
        throw new Error("作品情報の復元に失敗しました", { cause: restoreError });
      }
      throw replaceError;
    }
    return true;
  }
}

/** 退避して置き換えてよい既存の対象か。ディレクトリなど通常ファイル・symlink以外は対象外 */
function isReplaceableFile(path: string): boolean {
  try {
    const stat = lstatSync(path);
    return stat.isFile() || stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function removeQuietly(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // 既にrename済み、または未作成。
  }
}

/** `dir` に予測困難な名前の一時ファイルをwxで作り、書き込んでfsyncする。返り値は一時ファイルのパス */
export function writeTempFile(dir: string, label: string, bytes: Uint8Array): string {
  const tmp = join(dir, `.${label}.${crypto.randomUUID()}.tmp`);
  let fd: number | undefined;
  try {
    fd = openSync(tmp, "wx", 0o600);
    writeSync(fd, bytes);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    return tmp;
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    removeQuietly(tmp);
    throw error;
  }
}

/** 一時ファイルを `filePath` へrenameで確定する。成功・失敗とも一時ファイルは残さない */
export function commitTempFile(tmp: string, filePath: string): void {
  const rollback = join(
    dirname(filePath),
    `.${basename(filePath)}.${crypto.randomUUID()}.rollback`,
  );
  let rollbackCanBeRemoved = false;
  try {
    rollbackCanBeRemoved = replaceWithRollback(filePath, tmp, rollback, {
      exists: isReplaceableFile,
      rename: renameSync,
      unlink: unlinkSync,
    });
  } finally {
    removeQuietly(tmp);
    if (rollbackCanBeRemoved) removeQuietly(rollback);
  }
}

export function removeTempFile(tmp: string): void {
  removeQuietly(tmp);
}

export function installBytes(filePath: string, bytes: Uint8Array): void {
  const tmp = writeTempFile(dirname(filePath), basename(filePath), bytes);
  commitTempFile(tmp, filePath);
}
