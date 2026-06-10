// 設定（GET/PUT /api/settings）の契約。
import { z } from "zod";

export const settingsSchema = z.object({
  rootFolder: z.string().nullable(),
  lastScanTime: z.string().nullable(),
});
export type Settings = z.infer<typeof settingsSchema>;

export const settingsUpdateSchema = z.object({
  rootFolder: z.string().min(1),
});
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
