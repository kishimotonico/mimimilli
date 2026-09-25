// root再設定（GET/POST /api/root-reconfiguration）の契約（ADR-0029）。
import { z } from "zod";
import { scanProgressEventSchema } from "./scan.ts";

// 先頭が / の絶対パス、または Windows のドライブレター絶対パス（C:\... / C:/...）を受け付ける。
// Windowsネイティブ動作は恒久要件のため、動作中OSに関わらず両形式を許可する。
const ABSOLUTE_PATH_RE = /^(\/|[A-Za-z]:[\\/])/;

export const rootReconfigurationStateSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("idle"),
    /** 直近の再設定が完了した時刻。同一タブがreconfiguring・409のどちらも観測しないまま
     *  他タブの再設定が完了した場合を検知するのに使う（rootFolderだけでは同じパスへの
     *  再構築を拾えない）。再設定を一度も行っていなければnull。 */
    completedAt: z.string().nullable(),
  }),
  z.object({
    status: z.literal("running"),
    rootFolder: z.string(),
    /** 構築中のフルスキャンの最新進捗。 */
    progress: scanProgressEventSchema.nullable(),
  }),
  /** 構築の失敗、またはサーバー停止による中断。 */
  z.object({ status: z.literal("failed"), rootFolder: z.string(), message: z.string() }),
]);
export type RootReconfigurationState = z.infer<typeof rootReconfigurationStateSchema>;

export const rootReconfigurationStartRequestSchema = z.object({
  rootFolder: z
    .string()
    .trim()
    .min(1, "ルートフォルダーのパスを入力してください")
    .refine((path) => ABSOLUTE_PATH_RE.test(path), {
      message: "絶対パスを入力してください（例: /home/you/asmr、C:\\Users\\you\\ASMR）",
    }),
});
export type RootReconfigurationStartRequest = z.infer<typeof rootReconfigurationStartRequestSchema>;
