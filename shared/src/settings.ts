// 設定（GET /api/settings）の契約。
import { z } from "zod";
import { rootReconfigurationStateSchema } from "./rootReconfiguration.ts";

export const settingsSchema = z.object({
  rootFolder: z.string().nullable(),
  lastScanTime: z.string().nullable(),
  /** 直近の完了スキャンが対象にしたルートフォルダー。rootFolderと不一致なら一覧が未反映であることを示す */
  lastScanRootFolder: z.string().nullable(),
  rootReconfiguration: rootReconfigurationStateSchema,
});
export type Settings = z.infer<typeof settingsSchema>;
