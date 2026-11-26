import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export function isComposingKey(event: KeyboardEvent | ReactKeyboardEvent): boolean {
  const native = "nativeEvent" in event ? event.nativeEvent : event;
  return native.isComposing || native.keyCode === 229;
}

/** IME の変換中のキーは、項目の実行にも移動にも使わない */
export function ignoreComposingKey(event: ReactKeyboardEvent): void {
  if (isComposingKey(event)) event.stopPropagation();
}
