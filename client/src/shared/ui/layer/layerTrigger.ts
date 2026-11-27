import type { KeyboardEvent, MouseEvent } from "react";

export const MENU_OPEN_KEYS: ReadonlySet<string> = new Set(["ArrowDown", "ArrowUp", "Enter", " "]);
export const POPOVER_OPEN_KEYS: ReadonlySet<string> = new Set(["Enter", " "]);

/**
 * フォーカスを残したまま、トリガーが層を開く操作だけを受けなくする。
 * `disabled` 属性は付けない（押した後にフォーカスが落ちないように）。
 * Ark のトリガーは onClick・onKeyDown で defaultPrevented を見て開かない。
 */
export function disabledTriggerProps(disabled: boolean, openKeys: ReadonlySet<string>) {
  if (!disabled) return {};
  return {
    "data-disabled": "",
    "aria-disabled": true,
    onKeyDownCapture: (event: KeyboardEvent) => {
      if (openKeys.has(event.key)) event.preventDefault();
    },
    onClickCapture: (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
