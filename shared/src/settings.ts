// 設定（GET/PUT /api/settings）の契約。
import { z } from "zod";

export const settingsSchema = z.object({
  rootFolder: z.string().nullable(),
  lastScanTime: z.string().nullable(),
});
export type Settings = z.infer<typeof settingsSchema>;

// 先頭が / の絶対パス、または Windows のドライブレター絶対パス（C:\... / C:/...）を受け付ける。
// Windowsネイティブ動作は恒久要件のため、動作中OSに関わらず両形式を許可する。
const ABSOLUTE_PATH_RE = /^(\/|[A-Za-z]:[\\/])/;

export const settingsUpdateSchema = z.object({
  rootFolder: z
    .string()
    .trim()
    .min(1, "ルートフォルダーのパスを入力してください")
    .refine((path) => ABSOLUTE_PATH_RE.test(path), {
      message: "絶対パスを入力してください（例: /home/you/asmr、C:\\Users\\you\\ASMR）",
    }),
});
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
