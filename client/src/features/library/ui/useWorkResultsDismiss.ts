import { useEffect, type RefObject } from "react";

// 作品グリッド・作品リストの両方が使う結果面共通のEscape/背景クリック選択解除
// （TASK-428.12。旧 workGrid/useWorkGridDismiss をグリッド専用から一般化）。
export function useWorkResultsDismiss(
  isWorkSelected: boolean,
  onDeselect: () => void,
  scrollRef: RefObject<HTMLDivElement | null>,
  itemSelector: string,
) {
  useEffect(() => {
    if (!isWorkSelected) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;

      const target = event.target instanceof Element ? event.target : null;
      if (
        document.querySelector("dialog[open]") ||
        target?.closest('dialog, [role="dialog"]') ||
        target?.closest('input, textarea, select, [contenteditable="true"], [aria-expanded="true"]')
      ) {
        return;
      }

      onDeselect();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isWorkSelected, onDeselect]);

  useEffect(() => {
    if (!isWorkSelected) return;
    const scroll = scrollRef.current;
    if (!scroll) return;

    const handleBackgroundClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(itemSelector)) return;
      onDeselect();
    };

    scroll.addEventListener("click", handleBackgroundClick);
    return () => scroll.removeEventListener("click", handleBackgroundClick);
  }, [isWorkSelected, onDeselect, scrollRef, itemSelector]);
}
