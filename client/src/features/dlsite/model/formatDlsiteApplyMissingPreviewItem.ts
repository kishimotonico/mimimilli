import type { DlsiteApplyMissingPreviewItem } from "@mimimilli/shared";

/** 一括適用プレビューの1行に出す「何が追加されるか」の要約 */
export function formatDlsiteApplyMissingPreviewItem(item: DlsiteApplyMissingPreviewItem): string {
  const parts: string[] = [...item.newTags];
  if (item.applyCover) parts.push("カバー");
  if (item.applyUrl) parts.push("URL");
  return parts.join("・");
}
