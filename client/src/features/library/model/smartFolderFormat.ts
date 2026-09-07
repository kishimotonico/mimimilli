// スマートフォルダーの条件表示文言（演算子・長さ）を一箇所に集約する。
// SmartFolderEditorModal（エディタ）と SmartFolderView（結果バナー）は必ずこの関数経由で
// 文言を生成し、画面間で表記が揺れないようにする（TASK-428.11）。

interface SmartFolderRuleLike {
  field: "タグ" | "長さ";
  operator: string;
  values: string[];
}

/** タグ条件の演算子ラベル。長さは値と結合して1つの自然文にするため空文字を返す */
export function formatSmartFolderOperatorLabel(rule: SmartFolderRuleLike): string {
  return rule.field === "タグ" ? "を含む" : "";
}

/** 秒数を「1時間30分」のような自然文にする（0秒は「0分」） */
export function formatSmartFolderDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours === 0 && minutes === 0) return "0分";
  return `${hours > 0 ? `${hours}時間` : ""}${minutes > 0 ? `${minutes}分` : ""}`;
}

/** 長さ条件（値+演算子）を「1時間30分以上」の自然文にする */
export function formatSmartFolderLengthValue(rule: SmartFolderRuleLike): string {
  const seconds = Number(rule.values[0]);
  return `${formatSmartFolderDuration(seconds)}以上`;
}
