import type { ScanRecord } from "@mimimilli/shared";

/** 直近のスキャンで起きた変化（新規作品と更新済みの件数）。 */
export interface ScanChanges {
  finishedAt: string | null;
  newCount: number;
  updatedCount: number;
}

export function composeScanChanges(record: ScanRecord, newCount: number): ScanChanges {
  return {
    finishedAt: record.finishedAt,
    newCount,
    updatedCount: record.updatedWorks.length,
  };
}

export function totalScanChanges(changes: ScanChanges): number {
  return changes.newCount + changes.updatedCount;
}

/** 入口の点が「見た」を記憶するためのキー。変化のあったスキャンだけが持つ。 */
export function scanChangesKeys(changes: ScanChanges): string[] {
  return changes.finishedAt !== null && totalScanChanges(changes) > 0 ? [changes.finishedAt] : [];
}

export function scanChangesMessage(changes: ScanChanges): string {
  const parts: string[] = [];
  if (changes.newCount > 0) parts.push(`新規作品${changes.newCount}件`);
  if (changes.updatedCount > 0) parts.push(`更新済み${changes.updatedCount}件`);
  return parts.length > 0 ? `スキャン完了・${parts.join("・")}` : "スキャン完了・変化はありません";
}
