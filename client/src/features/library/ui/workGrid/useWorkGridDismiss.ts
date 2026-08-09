import { useEffect, type RefObject } from "react";

export function useWorkGridDismiss(
  isWorkSelected: boolean,
  onDeselect: () => void,
  scrollRef: RefObject<HTMLDivElement | null>,
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

    const handleGridBackgroundClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".mll-grid-tile")) return;
      onDeselect();
    };

    scroll.addEventListener("click", handleGridBackgroundClick);
    return () => scroll.removeEventListener("click", handleGridBackgroundClick);
  }, [isWorkSelected, onDeselect, scrollRef]);
}
