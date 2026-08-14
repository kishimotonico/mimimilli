// スキャンモーダルの左リスト⇄各タブの境界契約。親（ScanModal）がデータ取得・状態を持ち、
// 各タブコンポーネントはここで定義した props だけを受け取る。

export type ScanTabKey = "unregistered" | "needsAttention" | "newlyRegistered" | "updated";

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

/** UnregisteredTab が候補登録の成否をScanModalへ伝える契約（TASK-327/328境界）。
 *  registeredWorkIds は「新規登録済み」タブがinsertedWorkIdsとは別経路で拾う承認分のID。 */
export interface CandidatesRegisteredResult {
  registeredWorkIds: string[];
  failedCount: number;
  /** この登録の後もまだ未登録として残っている件数 */
  remainingCount: number;
}
