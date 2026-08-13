// `mimimilli.json`（Source of Truth）の読み書き。
// 書き込みは tmp ファイル + rename のアトミック更新。部分更新（書き戻し）は
// 生 JSON を直接編集し、スキーマが知らないユーザー定義フィールドを保持する。
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { META_FILE_NAME, metaFileSchema, type MetaFile } from "@mimimilli/shared";
import { detectRjCode } from "./dlsite.ts";
import { SourceChangedError } from "../../errors.ts";

export { SourceChangedError } from "../../errors.ts";

export { META_FILE_NAME };
export const META_SUFFIX = ".mimimilli.json";

/** ファイル名がメタファイルか（フォルダー形式 / 単一ファイル形式 `xxx.mimimilli.json`） */
export function isMetaFileName(name: string): boolean {
  return name === META_FILE_NAME || name.endsWith(META_SUFFIX);
}

export class MetaParseError extends Error {
  readonly metaPath: string;
  readonly candidateId: string | null;

  constructor(metaPath: string, detail: string, candidateId: string | null = null) {
    super(`メタファイルが不正です（${basename(metaPath)}）: ${detail}`);
    this.metaPath = metaPath;
    this.candidateId = candidateId;
  }
}

/** JSONだけを読む軽量経路。fingerprint 一致時はスキーマ検証を省略するために使う。 */
export function readMetaFileRaw(metaPath: string): unknown {
  const content = readFileSync(metaPath, "utf-8");
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new MetaParseError(metaPath, `JSON パースエラー: ${(e as Error).message}`);
  }
}

/** メタファイルを読み込み・検証する。JSON 不正・スキーマ違反は MetaParseError */
export function readMetaFile(metaPath: string): MetaFile {
  const raw = readMetaFileRaw(metaPath);
  const parsed = metaFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const candidateId =
      typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string"
        ? raw.id
        : null;
    throw new MetaParseError(
      metaPath,
      `${issue?.path.join(".") ?? ""} ${issue?.message ?? "不明"}`,
      candidateId,
    );
  }
  return parsed.data;
}

export function sourceRevision(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function readMetaSource(metaPath: string): {
  bytes: Buffer;
  meta: MetaFile;
  sourceRevision: string;
} {
  const bytes = readFileSync(metaPath);
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString("utf-8"));
  } catch (error) {
    throw new MetaParseError(metaPath, `JSON パースエラー: ${(error as Error).message}`);
  }
  const parsed = metaFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new MetaParseError(
      metaPath,
      `${issue?.path.join(".") ?? ""} ${issue?.message ?? "不明"}`,
    );
  }
  return { bytes, meta: parsed.data, sourceRevision: sourceRevision(bytes) };
}

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
        throw new Error("sidecarの復元に失敗しました", { cause: restoreError });
      }
      throw replaceError;
    }
    return true;
  }
}

function writeBytesAtomic(filePath: string, bytes: Buffer, expectedBytes?: Buffer): void {
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
    if (expectedBytes !== undefined && !readFileSync(filePath).equals(expectedBytes)) {
      throw new SourceChangedError();
    }
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

function writeJsonAtomic(filePath: string, value: unknown): void {
  writeBytesAtomic(filePath, Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf-8"));
}

/** メタファイルを新規作成する（自動生成用） */
export function writeMetaFile(metaPath: string, meta: MetaFile): void {
  writeJsonAtomic(metaPath, meta);
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

/**
 * sourceRevision を比較してsidecarを更新する。JSON objectを直接patchするので未知fieldと
 * 既存キー順を保持する。replace直前にもbytesを比較し、外部更新を上書きしない。
 */
export function patchMetaFileCas(
  metaPath: string,
  expectedSourceRevision: string,
  patch: MetaPatch,
): { meta: MetaFile; bytes: Buffer; sourceRevision: string } {
  const source = readMetaSource(metaPath);
  if (source.sourceRevision !== expectedSourceRevision) throw new SourceChangedError();
  const raw = JSON.parse(source.bytes.toString("utf-8")) as Record<string, unknown>;
  if (patch.title !== undefined) raw.title = patch.title;
  if (patch.tags !== undefined) raw.tags = patch.tags;
  if (patch.id !== undefined) raw.id = patch.id;
  if (patch.coverImage !== undefined) raw.coverImage = patch.coverImage;
  if (patch.urls !== undefined) raw.urls = patch.urls;
  if (patch.dlsite !== undefined) raw.dlsite = patch.dlsite;
  const parsed = metaFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new MetaParseError(
      metaPath,
      `${issue?.path.join(".") ?? ""} ${issue?.message ?? "不明"}`,
    );
  }
  const bytes = Buffer.from(JSON.stringify(raw, null, 2) + "\n", "utf-8");
  writeBytesAtomic(metaPath, bytes, source.bytes);
  return { meta: parsed.data, bytes, sourceRevision: sourceRevision(bytes) };
}

type JsonObject = Record<string, unknown>;

function playlistsOfRaw(raw: JsonObject): JsonObject[] | null {
  if (!Array.isArray(raw.playlists)) return null;
  return raw.playlists.filter(
    (playlist): playlist is JsonObject => typeof playlist === "object" && playlist !== null,
  );
}

/**
 * DB上の別パス作品とIDが衝突する場合、生JSONの id（work/playlist/track）だけを新UUIDへ再採番する。
 * スキーマ外のユーザー定義フィールドは保持する。
 */
export function reassignMetaIdsOnDbCollision(
  metaPath: string,
  shouldReassign: (workId: string) => boolean,
): string {
  const source = readMetaSource(metaPath);
  const raw = JSON.parse(source.bytes.toString("utf-8")) as JsonObject;
  if (typeof raw.id !== "string") {
    throw new MetaParseError(metaPath, "id が不正です");
  }
  if (!shouldReassign(raw.id)) {
    return raw.id;
  }

  const oldDefaultPlaylistId =
    typeof raw.defaultPlaylistId === "string" ? raw.defaultPlaylistId : null;
  raw.id = crypto.randomUUID();

  const playlists = playlistsOfRaw(raw);
  if (playlists) {
    let newDefaultPlaylistId: string | null = null;
    for (const playlist of playlists) {
      const oldPlaylistId = typeof playlist.id === "string" ? playlist.id : null;
      playlist.id = crypto.randomUUID();
      if (oldPlaylistId !== null && oldPlaylistId === oldDefaultPlaylistId) {
        newDefaultPlaylistId = playlist.id as string;
      }
      const tracks = playlist.tracks;
      if (Array.isArray(tracks)) {
        for (const track of tracks) {
          if (typeof track === "object" && track !== null) {
            (track as JsonObject).id = crypto.randomUUID();
          }
        }
      }
    }
    raw.defaultPlaylistId = newDefaultPlaylistId;
  }

  const parsed = metaFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new MetaParseError(
      metaPath,
      `${issue?.path.join(".") ?? ""} ${issue?.message ?? "不明"}`,
      typeof raw.id === "string" ? raw.id : null,
    );
  }
  writeBytesAtomic(
    metaPath,
    Buffer.from(JSON.stringify(raw, null, 2) + "\n", "utf-8"),
    source.bytes,
  );
  return raw.id as string;
}

/** メタファイルのパスから作品ディレクトリを返す（どちらの形式でも親ディレクトリ） */
export function workDirOf(metaPath: string): string {
  return dirname(metaPath);
}

/** フォルダー名・タイトルから RJ コードを検出し、メタと異なる場合は書き戻す。 */
export function syncDetectedRjCode(metaPath: string, workDirName: string): MetaFile["dlsite"] {
  const source = readMetaSource(metaPath);
  const detectedRjCode =
    source.meta.dlsite.rjCode ?? detectRjCode([workDirName, source.meta.title]);
  if (detectedRjCode === source.meta.dlsite.rjCode) {
    return source.meta.dlsite;
  }
  const dlsite = { ...source.meta.dlsite, rjCode: detectedRjCode };
  patchMetaFileCas(metaPath, source.sourceRevision, { dlsite });
  return dlsite;
}
