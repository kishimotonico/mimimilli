import { useEffect } from "react";
import { useLatest } from "../../lib/useLatest";

/**
 * 層ではない展開部分（インラインのパネル）を、ポップオーバーと同じ規則で閉じる。
 * 内側（トリガーとパネル）の外を pointerdown（capture）したら閉じ、そのクリックは通す。
 */
export function useDismissOnOutsidePress(
  open: boolean,
  isInside: (target: Node) => boolean,
  onDismiss: () => void,
): void {
  const latest = useLatest({ isInside, onDismiss });
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !latest.current.isInside(event.target)) {
        latest.current.onDismiss();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open, latest]);
}
