import type { KeyboardEventHandler, MouseEventHandler } from "react";

interface SoftDisabledHandlers {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onKeyDownCapture?: KeyboardEventHandler<HTMLButtonElement>;
}

/**
 * フォーカスを残したまま、ボタン自身の操作（クリック・Enter・Space）だけを受けなくする。
 * `disabled` 属性は付けない（押した後にフォーカスが落ちないように）。
 */
export function softDisabledHandlers(
  softDisabled: boolean,
  { onClick, onKeyDownCapture }: SoftDisabledHandlers,
): SoftDisabledHandlers & { "aria-disabled"?: true } {
  if (!softDisabled) return { onClick, onKeyDownCapture };
  return {
    "aria-disabled": true,
    onClick: (event) => event.preventDefault(),
    onKeyDownCapture: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
      } else {
        onKeyDownCapture?.(event);
      }
    },
  };
}
