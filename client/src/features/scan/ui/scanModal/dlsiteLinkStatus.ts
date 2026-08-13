// 外部連携列（新規登録済み・更新された作品タブ共通）の表示（文言・色）。
// 状態判定そのものは shared/src/dlsite.ts の dlsiteLinkDisplayStatus が正典。
import type { DlsiteLinkDisplayStatus } from "@mimimilli/shared";

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
