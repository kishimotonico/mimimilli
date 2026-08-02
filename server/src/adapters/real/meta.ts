// `mimimilli.json`（Source of Truth）の読み書き。
// 書き込みは tmp ファイル + rename のアトミック更新。部分更新（書き戻し）は
// 生 JSON を直接編集し、スキーマが知らないユーザー定義フィールドを保持する。
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { META_FILE_NAME, metaFileSchema, type MetaFile } from "@mimimilli/shared";

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

function writeJsonAtomic(filePath: string, value: unknown): void {
  const tmp = join(dirname(filePath), `.${basename(filePath)}.tmp`);
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf-8");
  renameSync(tmp, filePath);
}

/** メタファイルを新規作成する（自動生成用） */
export function writeMetaFile(metaPath: string, meta: MetaFile): void {
  writeJsonAtomic(metaPath, meta);
}

/**
 * メタファイルへの部分書き戻し（UI 編集時の即時反映）。
 * 生 JSON を読み、指定フィールドだけ更新して書き戻す。スキーマ外のフィールドは保持する。
 */
export function patchMetaFile(
  metaPath: string,
  patch: {
    title?: string;
    tags?: string[];
    id?: string;
    coverImage?: string | null;
    urls?: MetaFile["urls"];
    dlsite?: MetaFile["dlsite"];
  },
): void {
  const raw = JSON.parse(readFileSync(metaPath, "utf-8")) as Record<string, unknown>;
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
  writeJsonAtomic(metaPath, raw);
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
  const raw = JSON.parse(readFileSync(metaPath, "utf-8")) as JsonObject;
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
    if ("defaultPlaylist" in raw) delete raw.defaultPlaylist;
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
  writeJsonAtomic(metaPath, raw);
  return raw.id as string;
}

/** メタファイルのパスから作品ディレクトリを返す（どちらの形式でも親ディレクトリ） */
export function workDirOf(metaPath: string): string {
  return dirname(metaPath);
}
