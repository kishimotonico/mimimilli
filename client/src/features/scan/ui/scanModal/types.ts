// スキャンモーダルの左リスト⇄各タブの境界契約。親（ScanModal）がデータ取得・状態を持ち、
// 各タブコンポーネントはここで定義した props だけを受け取る。

import type { ScanExternalTab } from "../../../../shared/model/activeModalAtom";

// 外部（通知ベル・トースト）から直接指定できるタブはshared側を正とし、モーダル内部限定の
// タブ（新規作品・更新済み）をここで追加する。
export type ScanTabKey = ScanExternalTab | "newWorks" | "updated";

export const SCAN_TAB_ORDER: ScanTabKey[] = [
  "unregistered",
  "newWorks",
  "needsAttention",
  "updated",
];

export const SCAN_TAB_LABEL: Record<ScanTabKey, string> = {
  unregistered: "未登録",
  newWorks: "新規作品",
  needsAttention: "要対応",
  updated: "更新済み",
};

/** 件数を出すタブ。開いているタブには出さない */
export const SCAN_TAB_WITH_COUNT: ReadonlySet<ScanTabKey> = new Set([
  "unregistered",
  "needsAttention",
]);

/** UnregisteredTab が候補登録の成否をScanModalへ伝える契約。 */
export interface CandidatesRegisteredResult {
  registeredCount: number;
  failedCount: number;
  /** 途中で止まったか（候補の変更など） */
  interrupted: boolean;
}
