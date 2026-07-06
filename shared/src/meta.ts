// `.meta.json`（Source of Truth）のスキーマ。要件 v4 §3.2 を契約として固定したもの。
// パース失敗・必須フィールド欠落は「メタファイル不正」エラーとして作品に表示する（隠蔽しない）。
import { z } from "zod";
import { playlistSchema, urlEntrySchema } from "./work.ts";

export const metaFileSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1),
    urls: z.array(urlEntrySchema).default([]),
    tags: z.array(z.string()).default([]),
    coverImage: z.string().nullish().default(null),
    playlists: z.array(playlistSchema).default([]),
    defaultPlaylist: z.string().nullish().default(null),
    createdAt: z.iso.datetime({ offset: true }).optional(),
  })
  .superRefine((meta, ctx) => {
    if (
      meta.defaultPlaylist &&
      !meta.playlists.some((playlist) => playlist.name === meta.defaultPlaylist)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultPlaylist"],
        message: `指定されたプレイリストが存在しません: ${meta.defaultPlaylist}`,
      });
    }
  });
export type MetaFile = z.infer<typeof metaFileSchema>;

/** メタファイル名。作品フォルダー直下、または単一ファイル形式では `<basename>.meta.json` */
export const META_FILE_NAME = ".meta.json";
