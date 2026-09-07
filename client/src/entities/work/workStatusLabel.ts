import type { WorkStatus } from "@mimimilli/shared";

/** grid・list・preview・詳細・軸で共通のファイル欠損／メタ読み込みエラー表記（TASK-428.5） */
export const WORK_STATUS_LABEL: Record<Exclude<WorkStatus, "ok">, string> = {
  missing: "ファイル欠損",
  error: "メタ読み込みエラー",
};

export function getWorkStatusLabel(status: WorkStatus): string | null {
  return status === "ok" ? null : WORK_STATUS_LABEL[status];
}
