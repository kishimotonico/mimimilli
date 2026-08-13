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
