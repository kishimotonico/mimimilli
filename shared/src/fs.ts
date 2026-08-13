// 物理ファイルシステムブラウズ（Filesモード、GET /api/fs）の契約。
import { z } from "zod";
import { mediaKindSchema, previewCapabilitySchema, workspacePathSchema } from "./media.ts";

export const fsEntrySchema = z.object({
  name: z.string(),
  /** root 相対・portable なパス */
  path: workspacePathSchema,
  isDir: z.boolean(),
  size: z.number(),
  fileType: z.string(),
  /** dir のとき子要素数 */
  childCount: z.number().int().nonnegative(),
  /** dir が登録作品ルート、または file が作品配下のとき所属作品 ID */
  workId: z.string().nullable(),
  /** file のとき所属作品からの相対パス（メディア配信 URL 用） */
  workRelPath: z.string().nullable(),
  mediaKind: mediaKindSchema.nullable(),
  preview: previewCapabilitySchema.nullable(),
});
export type FsEntry = z.infer<typeof fsEntrySchema>;

export const fsListingSchema = z.object({
  path: workspacePathSchema.nullable(),
  parent: workspacePathSchema.nullable(),
  /** この dir 自身が登録作品ルートなら作品 ID */
  workId: z.string().nullable(),
  entries: z.array(fsEntrySchema),
});
export type FsListing = z.infer<typeof fsListingSchema>;
