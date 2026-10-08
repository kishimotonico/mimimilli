import { useCallback, type KeyboardEvent } from "react";

interface InlineEditKeyDownOptions {
  onCommit: () => void;
  onCancel: () => void;
}

// インライン編集入力のEnter確定・Escape取り消し。IME変換中のキーは扱わない。
export function useInlineEditKeyDown({ onCommit, onCancel }: InlineEditKeyDownOptions) {
  return useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (event.key === "Enter") onCommit();
      if (event.key === "Escape") {
        // 入力欄側で編集を取り消し、モーダルのEscapeクローズ（<dialog>のcancel既定動作）
        // まで伝播させない。親は編集中かどうかを知らなくてよい。
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    },
    [onCommit, onCancel],
  );
}
