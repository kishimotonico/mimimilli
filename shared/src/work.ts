// work ドメインのスキーマ。client/src/entities/work/model.ts の型を契約として固定したもの。
import { z } from "zod";

export const urlEntrySchema = z.object({
  label: z.string(),
  url: z.string(),
});
export type UrlEntry = z.infer<typeof urlEntrySchema>;

/** トラック = 「指定ファイルの指定区間を再生する」。start/end 省略時はファイル全体 */
export const trackSchema = z.object({
  title: z.string(),
  file: z.string(),
  start: z.number().nonnegative().optional(),
  end: z.number().nonnegative().optional(),
});
export type Track = z.infer<typeof trackSchema>;

export const playlistSchema = z.object({
  name: z.string(),
  tracks: z.array(trackSchema),
});
export type Playlist = z.infer<typeof playlistSchema>;

export const workStatusSchema = z.enum(["ok", "missing", "error"]);
export type WorkStatus = z.infer<typeof workStatusSchema>;

export const workSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  coverImage: z.string().nullable(),
  status: workStatusSchema,
  physicalPath: z.string(),
  totalDurationSec: z.number(),
  addedAt: z.string(),
  errorMessage: z.string().nullable(),
  urls: z.array(urlEntrySchema),
  tags: z.array(z.string()),
  trackCount: z.number().int().nonnegative(),
  bookmarked: z.boolean(),
  lastPlayedAt: z.string().nullable(),
});
export type WorkSummary = z.infer<typeof workSummarySchema>;

export const workSchema = workSummarySchema.omit({ trackCount: true }).extend({
  defaultPlaylist: z.string().nullable(),
  createdAt: z.string().nullable(),
  playlists: z.array(playlistSchema),
  resumePosition: z.number().nonnegative(),
  resumeTrackIndex: z.number().int().nonnegative(),
});
export type Work = z.infer<typeof workSchema>;

/** 作品配下の物理ファイルツリー（GET /api/works/:id/files） */
export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  fileType: string;
  children: FileEntry[];
}

export const fileEntrySchema: z.ZodType<FileEntry> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    isDir: z.boolean(),
    size: z.number(),
    fileType: z.string(),
    children: z.array(fileEntrySchema),
  }),
);

// ── タグ解析 ──────────────────────────────────────────────────

export interface ParsedTag {
  kind: "annotated" | "flat";
  prefix: string;
  value: string;
  raw: string;
}

/** タグ文字列（"cv/水瀬なずな", "サークル/夜想曲", "バイノーラル" など）を解析する。
 *  最初のスラッシュでのみ分割する（値にスラッシュが含まれてもよい） */
export function parseTag(tag: string): ParsedTag {
  const idx = tag.indexOf("/");
  if (idx > 0) {
    return {
      kind: "annotated",
      prefix: tag.slice(0, idx).toLowerCase(),
      value: tag.slice(idx + 1),
      raw: tag,
    };
  }
  return { kind: "flat", prefix: "", value: tag, raw: tag };
}
