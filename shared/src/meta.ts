// `mimimilli.json`（Source of Truth）のスキーマ。要件 v4 §3.2 を契約として固定したもの。
// パース失敗・必須フィールド欠落は「メタファイル不正」エラーとして作品に表示する（隠蔽しない）。
import { z } from "zod";
import { dlsiteStateSchema, emptyDlsiteState } from "./dlsite.ts";
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
    id: z.uuid(),
    title: z.string().min(1),
    urls: z.array(urlEntrySchema).default([]),
    // Source of Truth。API経由の書き込み（workPatchSchema/workCreateBodySchema）と同じ
    // tagSchema + normalizeTags を通す。外部からの直接編集や旧データにも予約文字契約を効かせる。
    tags: z
      .array(tagSchema)
      .default([])
      .transform((tags) => dedupeTags(normalizeTags(tags))),
    coverImage: z.string().nullish().default(null),
    playlists: z.array(playlistSchema).default([]),
    defaultPlaylistId: z.uuid({ version: "v4" }).nullish().default(null),
    createdAt: z.iso.datetime({ offset: true }).optional(),
    dlsite: dlsiteStateSchema.default(emptyDlsiteState),
  })
  .superRefine((meta, ctx) => {
    refinePlaylistCollection(meta.playlists, meta.defaultPlaylistId, ctx);
  });
export type MetaFile = z.infer<typeof metaFileSchema>;

/** メタファイル名（フォルダー形式）。単一ファイル形式では `<basename>.mimimilli.json` */
export const META_FILE_NAME = "mimimilli.json";
