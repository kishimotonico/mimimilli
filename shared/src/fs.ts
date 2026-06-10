// 物理ファイルシステムブラウズ（Filesモード、GET /api/fs）の契約。
import { z } from "zod";

export const fsEntrySchema = z.object({
  name: z.string(),
  /** 絶対物理パス（次に browse する dir / 選択キー） */
  path: z.string(),
  isDir: z.boolean(),
  size: z.number(),
  fileType: z.string(),
  /** dir のとき子要素数 */
  childCount: z.number().int().nonnegative(),
  /** dir が登録作品ルート、または file が作品配下のとき所属作品 ID */
  workId: z.string().nullable(),
  /** file のとき所属作品からの相対パス（メディア配信 URL 用） */
  workRelPath: z.string().nullable(),
});
export type FsEntry = z.infer<typeof fsEntrySchema>;

export const fsListingSchema = z.object({
  /** この listing の dir 絶対パス */
  path: z.string(),
  /** 親 dir 絶対パス（ルートなら null） */
  parent: z.string().nullable(),
  /** この dir 自身が登録作品ルートなら作品 ID */
  workId: z.string().nullable(),
  entries: z.array(fsEntrySchema),
});
export type FsListing = z.infer<typeof fsListingSchema>;
