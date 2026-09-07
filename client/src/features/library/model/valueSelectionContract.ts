// 値選択操作の入口ごとの契約（ADR-0013、design-system.md「ライブラリ: チップ列・値一覧行・
// オーバーレイ」節）。各入口は「既定の意図」（置き換え or AND追加）だけを宣言し、主クリックの
// 意味・Ctrl/Cmd反転先・追加ボタンの有無はここから一意に導出する。既定=AND追加の入口では
// 追加ボタン自体が存在しない（derive の戻り値に onAddButton フィールドが無い）ため、
// 「AND追加が既定なのに追加ボタンあり」のような組み合わせは型で表現できない。
//
// 「件数基準」（TASK-428.14）もこの契約から導出する: 既定=置き換えの入口は主クリックの結果
// （選択タグを丸ごと置き換えた後の件数）と一致させるため無条件集計、既定=AND追加の入口は
// 「今の選択に追加したら何件になるか」を示すため現在の選択タグ込みの集計にする。

import type { NormalizedTag } from "@mimimilli/shared";

type ClickModifiers = { ctrlKey: boolean; metaKey: boolean };

export type ValueSelectionIntent<T> =
  | {
      default: "replace";
      onReplace: (value: T) => void;
      /** Ctrl/Cmd+クリックによる反転先。選択済みなら解除できる */
      onToggle: (value: T) => void;
      /** 追加ボタン用。冪等（選択済みなら何もしない） */
      onAdd: (value: T) => void;
    }
  | {
      default: "add";
      /** 主クリック用。冪等（選択済みなら何もしない） */
      onAdd: (value: T) => void;
      /** Ctrl/Cmd+クリックによる反転先 */
      onReplace: (value: T) => void;
    };

function isModifierClick(opts: ClickModifiers): boolean {
  return opts.ctrlKey || opts.metaKey;
}

export function deriveValueSelectionHandlers<T>(
  intent: Extract<ValueSelectionIntent<T>, { default: "replace" }>,
): { onSelect: (value: T, opts: ClickModifiers) => void; onAddButton: (value: T) => void };
export function deriveValueSelectionHandlers<T>(
  intent: Extract<ValueSelectionIntent<T>, { default: "add" }>,
): { onSelect: (value: T, opts: ClickModifiers) => void };
export function deriveValueSelectionHandlers<T>(intent: ValueSelectionIntent<T>): {
  onSelect: (value: T, opts: ClickModifiers) => void;
  onAddButton?: (value: T) => void;
} {
  if (intent.default === "replace") {
    return {
      onSelect: (value, opts) =>
        isModifierClick(opts) ? intent.onToggle(value) : intent.onReplace(value),
      onAddButton: intent.onAdd,
    };
  }
  return {
    onSelect: (value, opts) =>
      isModifierClick(opts) ? intent.onReplace(value) : intent.onAdd(value),
  };
}

/** 軸ファセット件数（GET /axes/:axis）の集計に使うタグ。件数基準（本ファイル冒頭）を
 *  intent から一意に導出する。呼び出し側でハードコードしない。 */
export function deriveFacetCountTags<T>(
  intent: ValueSelectionIntent<T>,
  selectedTags: NormalizedTag[],
): NormalizedTag[] {
  return intent.default === "replace" ? [] : selectedTags;
}

/** 既定動作の説明文。全ての値選択入口（軸レールのクイックオーバーレイ・チップの兄弟値
 *  ドロップダウン・「＋絞り込み」・結果面の値一覧）で共通のヒント表示に使う。
 *  文言を各入口で直書きせず、ここから一意に導出する。intent 全体を組み立てる前
 *  （「＋絞り込み」の軸選択ステージ等）でも使えるよう default だけを受け取る。 */
export function getValueSelectionHint(
  defaultAction: ValueSelectionIntent<unknown>["default"],
): string {
  return defaultAction === "replace"
    ? "クリックで置き換え・Ctrl+クリックでAND追加"
    : "AND追加されます";
}
