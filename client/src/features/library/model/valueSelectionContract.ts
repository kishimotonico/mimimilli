// 値選択操作の入口ごとの契約（ADR-0013、design-system.md「ライブラリ: チップ列・値一覧行・
// オーバーレイ」節）。各入口は「既定の意図」（置き換え or AND追加）だけを宣言し、主クリックの
// 意味・Ctrl/Cmd反転先・追加ボタンの有無はここから一意に導出する。既定=AND追加の入口では
// 追加ボタン自体が存在しない（derive の戻り値に onAddButton フィールドが無い）ため、
// 「AND追加が既定なのに追加ボタンあり」のような組み合わせは型で表現できない。

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
