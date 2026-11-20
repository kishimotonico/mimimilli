// スキャンモーダルの左リスト⇄各タブの境界契約。親（ScanModal）がデータ取得・状態を持ち、
// 各タブコンポーネントはここで定義した props だけを受け取る。

export type ScanTabKey = "unregistered" | "newWorks" | "needsAttention" | "updated";

/** サイドバーの並びであり、開いたときに件数のあるタブを探す順 */
export const SCAN_TAB_ORDER: ScanTabKey[] = [
  "unregistered",
  "needsAttention",
  "newWorks",
  "updated",
];

export const SCAN_TAB_LABEL: Record<ScanTabKey, string> = {
  unregistered: "未登録",
  newWorks: "新規作品",
  needsAttention: "要対応",
  updated: "更新済み",
};

/** UnregisteredTab が候補登録の成否をScanModalへ伝える契約。 */
export interface CandidatesRegisteredResult {
  registeredCount: number;
  failedCount: number;
  /** 追加できた作品のうち、選んだカバーを適用できなかった件数 */
  coverSkippedCount: number;
  /** 途中で止まったか（候補の変更など） */
  interrupted: boolean;
}
