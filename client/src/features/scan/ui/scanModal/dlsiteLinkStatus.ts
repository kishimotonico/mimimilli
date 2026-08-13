// 外部連携列（新規登録済み・更新された作品タブ共通）の表示状態判定。
import { hasRjCode, isDlsiteLinkFailed } from "@mimimilli/shared";
import type { WorkListItemDlsite } from "@mimimilli/shared";

export type DlsiteLinkDisplayStatus = "linked" | "pending" | "failed" | "none";

export function dlsiteLinkDisplayStatus(dlsite: WorkListItemDlsite): DlsiteLinkDisplayStatus {
  if (!hasRjCode(dlsite)) return "none";
  if (dlsite.status === "applied") return "linked";
  if (isDlsiteLinkFailed(dlsite)) return "failed";
  return "pending";
}

export const DLSITE_LINK_STATUS_LABEL: Record<DlsiteLinkDisplayStatus, string> = {
  linked: "連携済み",
  pending: "取得待ち",
  failed: "失敗",
  none: "—",
};

export const DLSITE_LINK_STATUS_TONE: Record<DlsiteLinkDisplayStatus, string> = {
  linked: "text-[var(--r-leaf)]",
  pending: "text-ink-3",
  failed: "text-[var(--r-coral)]",
  none: "text-ink-4",
};
