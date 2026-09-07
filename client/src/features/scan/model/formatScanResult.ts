import type { ScanResult } from "@mimimilli/shared";

/** スキャン完了トーストの文言。通知ベルの「直近のスキャン結果」と同じ語彙に揃える（TASK-428.4） */
export function formatScanResult(result: ScanResult): string {
  return `登録 ${result.registered}件・新規 ${result.insertedWorkIds.length}件・エラー ${result.errors}件・行方不明 ${result.missing}件`;
}
