// `mimimilli.json`（Source of Truth）のスキーマ。要件 v4 §3.2 を契約として固定したもの。
// パース失敗・必須フィールド欠落は「メタファイル不正」エラーとして作品に表示する（隠蔽しない）。
import { z } from "zod";
import { emptyMetaDlsiteState, metaDlsiteStateSchema } from "./dlsite.ts";
import {
  dedupeTags,
  normalizeTags,
  playlistSchema,
  refinePlaylistCollection,
  tagSchema,
  urlEntrySchema,
} from "./work.ts";

export const metaFileSchema = z
  .object({
    formatVersion: z.literal(1),
    id: z.uuid(),
    title: z.string().min(1),
    urls: z.array(urlEntrySchema).default([]),
    // Source of Truth。API経由の書き込み（workSourcePatchSchema/workCreateBodySchema）と同じ
    // tagSchema + normalizeTags を通す。外部からの直接編集や旧データにも予約文字契約を効かせる。
    tags: z
      .array(tagSchema)
      .default([])
      .transform((tags) => dedupeTags(normalizeTags(tags))),
    coverImage: z.string().nullish().default(null),
    playlists: z.array(playlistSchema).default([]),
    defaultPlaylistId: z.uuid({ version: "v4" }).nullish().default(null),
    createdAt: z.iso.datetime({ offset: true }).optional(),
    dlsite: metaDlsiteStateSchema.default(emptyMetaDlsiteState),
  })
  .superRefine((meta, ctx) => {
    refinePlaylistCollection(meta.playlists, meta.defaultPlaylistId, ctx);
  });
export type MetaFile = z.infer<typeof metaFileSchema>;

/** メタファイル名（フォルダー形式）。単一ファイル形式では `<basename>.mimimilli.json` */
export const META_FILE_NAME = "mimimilli.json";

/** 単一ファイル形式のサイドカーメタ（`d00001.mp3` → `d00001.mimimilli.json`） */
export const META_SIDECAR_SUFFIX = ".mimimilli.json";

/** 単一ファイル作品として扱う音声拡張子（要件 1.5） */
export const AUDIO_WORK_EXTENSIONS = new Set([
  "mp3",
  "m4a",
  "aac",
  "wav",
  "ogg",
  "flac",
  "webm",
  "opus",
]);

export function fileExtensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function isAudioFileName(name: string): boolean {
  return AUDIO_WORK_EXTENSIONS.has(fileExtensionOf(name));
}

function pathBasename(path: string): string {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return cut < 0 ? path : path.slice(cut + 1);
}

export function isSidecarMetaFileName(name: string): boolean {
  return name.endsWith(META_SIDECAR_SUFFIX) && name !== META_FILE_NAME;
}

/** 音声ファイル名からサイドカーメタのファイル名を作る */
export function sidecarMetaFileName(audioFileName: string): string {
  const stem = audioFileName.replace(/\.[^.]+$/, "");
  return `${stem}${META_SIDECAR_SUFFIX}`;
}

/** physicalPath が単一ファイル作品（音声ファイル本体）か */
export function isAudioWorkPath(physicalPath: string): boolean {
  return isAudioFileName(pathBasename(physicalPath));
}

/** トラック・カバーを解決するディレクトリ。単一ファイル作品は親フォルダー */
export function workMediaRoot(physicalPath: string): string {
  if (!isAudioWorkPath(physicalPath)) return physicalPath;
  const cut = Math.max(physicalPath.lastIndexOf("/"), physicalPath.lastIndexOf("\\"));
  return cut <= 0 ? physicalPath : physicalPath.slice(0, cut);
}
