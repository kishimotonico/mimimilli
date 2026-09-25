// 設定（GET /api/settings）の契約。
import { z } from "zod";
import { rootReconfigurationStateSchema } from "./rootReconfiguration.ts";

export const settingsSchema = z.object({
  rootFolder: z.string().nullable(),
  lastScanTime: z.string().nullable(),
  rootReconfiguration: rootReconfigurationStateSchema,
});
export type Settings = z.infer<typeof settingsSchema>;
