// `mimimilli.json`（Source of Truth）の読み書き。
// 書き込みは lock 内で read → コールバック → fsync/atomic replace の mutateMetaSource 1本。
// 部分更新は生 JSON を直接編集し、スキーマが知らないユーザー定義フィールドを保持する。
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { META_FILE_NAME, metaFileSchema, type MetaFile } from "@mimimilli/shared";
import { SourceChangedError } from "../../errors.ts";

export { SourceChangedError } from "../../errors.ts";

export { META_FILE_NAME };
export const META_SUFFIX = ".mimimilli.json";

/** ファイル名がメタファイルか（フォルダー形式 / 単一ファイル形式 `xxx.mimimilli.json`） */
export function isMetaFileName(name: string): boolean {
  return name === META_FILE_NAME || name.endsWith(META_SUFFIX);
}

export type MetaParseKind = "json" | "schema" | "formatVersion";

export class MetaParseError extends Error {
  readonly metaPath: string;
  readonly candidateId: string | null;
  readonly kind: MetaParseKind;

  constructor(
    metaPath: string,
    detail: string,
    candidateId: string | null = null,
    kind: MetaParseKind = "schema",
  ) {
    super(`メタファイルが不正です（${basename(metaPath)}）: ${detail}`);
    this.metaPath = metaPath;
    this.candidateId = candidateId;
    this.kind = kind;
  }
}

export type MetaSource = {
  bytes: Buffer;
  meta: MetaFile;
  sourceRevision: string;
};

export class MetaMutationReject {
  readonly error: Error;
  constructor(error: Error) {
    this.error = error;
  }
}

function candidateIdOf(raw: unknown): string | null {
  return typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string"
    ? raw.id
    : null;
}

function parseMetaRaw(metaPath: string, raw: unknown): MetaFile {
  const candidateId = candidateIdOf(raw);
  if (
    typeof raw === "object" &&
    raw !== null &&
    "formatVersion" in raw &&
    (raw as { formatVersion: unknown }).formatVersion !== 1
  ) {
    throw new MetaParseError(metaPath, "unsupported formatVersion", candidateId, "formatVersion");
  }
  const parsed = metaFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new MetaParseError(
      metaPath,
      `${issue?.path.join(".") ?? ""} ${issue?.message ?? "不明"}`,
      candidateId,
      "schema",
    );
  }
  return parsed.data;
}

/** JSONだけを読む軽量経路。fingerprint 一致時はスキーマ検証を省略するために使う。 */
export function readMetaFileRaw(metaPath: string): unknown {
  const content = readFileSync(metaPath, "utf-8");
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new MetaParseError(metaPath, `JSON パースエラー: ${(e as Error).message}`, null, "json");
  }
}

/** メタファイルを読み込み・検証する。JSON 不正・スキーマ違反は MetaParseError */
export function readMetaFile(metaPath: string): MetaFile {
  return parseMetaRaw(metaPath, readMetaFileRaw(metaPath));
}

export function sourceRevision(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function readMetaSource(metaPath: string): MetaSource {
  const bytes = readFileSync(metaPath);
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString("utf-8"));
  } catch (error) {
    throw new MetaParseError(
      metaPath,
      `JSON パースエラー: ${(error as Error).message}`,
      null,
      "json",
    );
  }
  return { bytes, meta: parseMetaRaw(metaPath, raw), sourceRevision: sourceRevision(bytes) };
}

export interface AtomicReplaceOps {
  exists(path: string): boolean;
  rename(from: string, to: string): void;
  unlink(path: string): void;
}

function waitMs(ms: number): void {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const META_WRITE_LOCK_TIMEOUT_MS = 5_000;
const META_WRITE_LOCK_STALE_MS = 10_000;

function stealStaleMetaLock(lockPath: string): boolean {
  try {
    const { mtimeMs } = statSync(lockPath);
    if (Date.now() - mtimeMs < META_WRITE_LOCK_STALE_MS) return false;
    unlinkSync(lockPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}

function withMetaPathLock<T>(filePath: string, fn: () => T): T {
  const lockPath = join(dirname(filePath), `.${basename(filePath)}.lock`);
  let lockFd: number | undefined;
  const deadline = Date.now() + META_WRITE_LOCK_TIMEOUT_MS;
  while (true) {
    try {
      lockFd = openSync(lockPath, "wx", 0o600);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (stealStaleMetaLock(lockPath)) continue;
      if (Date.now() >= deadline) {
        throw new Error(`作品情報の書き込みロックを取得できません（${basename(filePath)}）`);
      }
      waitMs(10);
    }
  }
  try {
    return fn();
  } finally {
    if (lockFd !== undefined) closeSync(lockFd);
    try {
      unlinkSync(lockPath);
    } catch {
      /* lock cleanup */
    }
  }
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

function installBytes(filePath: string, bytes: Buffer): void {
  const tmp = join(dirname(filePath), `.${basename(filePath)}.${crypto.randomUUID()}.tmp`);
  const rollback = join(
    dirname(filePath),
    `.${basename(filePath)}.${crypto.randomUUID()}.rollback`,
  );
  let fd: number | undefined;
  let rollbackCanBeRemoved = false;
  try {
    fd = openSync(tmp, "wx", 0o600);
    writeSync(fd, bytes);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    rollbackCanBeRemoved = replaceWithRollback(filePath, tmp, rollback, {
      exists: existsSync,
      rename: renameSync,
      unlink: unlinkSync,
    });
  } finally {
    if (fd !== undefined) closeSync(fd);
    try {
      unlinkSync(tmp);
    } catch {
      // rename済み、または一時ファイル未作成。
    }
    if (rollbackCanBeRemoved) {
      try {
        unlinkSync(rollback);
      } catch {
        /* rollback cleanup */
      }
    }
  }
}

/** メタファイルを新規作成する（自動生成用） */
export function writeMetaFile(
  metaPath: string,
  meta: MetaFile,
): { meta: MetaFile; bytes: Buffer; sourceRevision: string } {
  const bytes = Buffer.from(JSON.stringify(meta, null, 2) + "\n", "utf-8");
  withMetaPathLock(metaPath, () => {
    installBytes(metaPath, bytes);
  });
  return { meta, bytes, sourceRevision: sourceRevision(bytes) };
}

/**
 * lock 取得 → readMetaSource → コールバック → 書込み → unlock。
 * 読取り・判定・書込みが全部 lock 内で、TOCTOU の窓が無い。
 */
export function mutateMetaSource(
  metaPath: string,
  mutate: (source: MetaSource) => Uint8Array | MetaMutationReject,
): MetaSource {
  return withMetaPathLock(metaPath, () => {
    const source = readMetaSource(metaPath);
    const next = mutate(source);
    if (next instanceof MetaMutationReject) {
      throw next.error;
    }
    const bytes = Buffer.from(next);
    if (bytes.equals(source.bytes)) return source;
    let raw: unknown;
    try {
      raw = JSON.parse(bytes.toString("utf-8"));
    } catch (error) {
      throw new MetaParseError(
        metaPath,
        `JSON パースエラー: ${(error as Error).message}`,
        null,
        "json",
      );
    }
    const meta = parseMetaRaw(metaPath, raw);
    installBytes(metaPath, bytes);
    return { bytes, meta, sourceRevision: sourceRevision(bytes) };
  });
}

/**
 * メタファイルへの部分書き戻し（UI 編集時の即時反映）。
 * 生 JSON を読み、指定フィールドだけ更新して書き戻す。スキーマ外のフィールドは保持する。
 */
type MetaPatch = {
  title?: string;
  tags?: string[];
  id?: string;
  coverImage?: string | null;
  urls?: MetaFile["urls"];
  dlsite?: MetaFile["dlsite"];
};

function applyMetaPatchToRaw(raw: Record<string, unknown>, patch: MetaPatch): void {
  if (patch.title !== undefined) raw.title = patch.title;
  if (patch.tags !== undefined) raw.tags = patch.tags;
  if (patch.id !== undefined) raw.id = patch.id;
  if (patch.coverImage !== undefined) raw.coverImage = patch.coverImage;
  if (patch.urls !== undefined) raw.urls = patch.urls;
  if (patch.dlsite !== undefined) raw.dlsite = patch.dlsite;
}

export function encodeMetaRaw(raw: unknown): Buffer {
  return Buffer.from(JSON.stringify(raw, null, 2) + "\n", "utf-8");
}

/**
 * sourceRevision を比較してmimimilli.jsonを更新する。JSON objectを直接patchするので未知fieldと
 * 既存キー順を保持する。比較も書込みも mutateMetaSource の lock 内で行う。
 */
export function patchMetaFileCas(
  metaPath: string,
  expectedSourceRevision: string,
  patch: MetaPatch,
): MetaSource {
  return mutateMetaSource(metaPath, (source) => {
    if (source.sourceRevision !== expectedSourceRevision) {
      return new MetaMutationReject(new SourceChangedError());
    }
    const raw = JSON.parse(source.bytes.toString("utf-8")) as Record<string, unknown>;
    applyMetaPatchToRaw(raw, patch);
    return encodeMetaRaw(raw);
  });
}
