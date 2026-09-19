import { atom } from "jotai";

/** DLsite通知モーダルの種別 */
export const DLSITE_NOTIFICATION_MODAL_KINDS = [
  "rj-missing",
  "fetch-failed",
  "parse-failed",
] as const;

export type DlsiteNotificationModalKind = (typeof DLSITE_NOTIFICATION_MODAL_KINDS)[number];

export function isDlsiteNotificationModal(
  modal: string | null,
): modal is DlsiteNotificationModalKind {
  return modal !== null && (DLSITE_NOTIFICATION_MODAL_KINDS as readonly string[]).includes(modal);
}

/** スキャンモーダルを外部（通知ベル・トースト）から直接指定できるタブ。
 *  モーダル内部限定のタブ（新規登録済み・更新された作品）はfeatures/scan側の型が別途持つ */
export type ScanExternalTab = "unregistered" | "needsAttention";

/** アプリ全体で唯一開けるモーダルの状態。null は全て閉じている状態 */
export type ActiveModal =
  | { kind: "settings" }
  | { kind: "scan"; tab?: ScanExternalTab }
  | { kind: DlsiteNotificationModalKind };

export const activeModalAtom = atom<ActiveModal | null>(null);
