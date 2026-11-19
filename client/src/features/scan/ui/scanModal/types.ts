// スキャンモーダルの左リスト⇄各タブの境界契約。親（ScanModal）がデータ取得・状態を持ち、
// 各タブコンポーネントはここで定義した props だけを受け取る。

import type { ScanExternalTab } from "../../../../shared/model/activeModalAtom";

// 外部（通知ベル・トースト）から直接指定できるタブはshared側を正とし、モーダル内部限定の
// タブ（新規登録済み・更新された作品）をここで追加する。
export type ScanTabKey = ScanExternalTab | "newlyRegistered" | "updated";

export const SCAN_TAB_ORDER: ScanTabKey[] = [
  "unregistered",
  "needsAttention",
  "newlyRegistered",
  "updated",
];

export const SCAN_TAB_LABEL: Record<ScanTabKey, string> = {
  unregistered: "未登録",
  needsAttention: "要対応",
  newlyRegistered: "新規登録済み",
  updated: "更新された作品",
};

/** UnregisteredTab が候補登録の成否をScanModalへ伝える契約。 */
export interface CandidatesRegisteredResult {
  registeredCount: number;
  failedCount: number;
  /** 途中で止まったか（候補の変更など） */
  interrupted: boolean;
}
