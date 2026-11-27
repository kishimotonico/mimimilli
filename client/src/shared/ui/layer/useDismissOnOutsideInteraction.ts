import { useEffect } from "react";
import { useLatest } from "../../lib/useLatest";

/**
 * 層ではない展開部分（インラインのパネル）を、ポップオーバーと同じ規則で閉じる。
 * 内側（トリガーとパネル）の外への pointerdown（capture）と、外へのフォーカス移動で閉じる。
 * pointerdown は止めず、押された要素の操作は通す。
 */
export function useDismissOnOutsideInteraction(
  open: boolean,
  isInside: (target: Node) => boolean,
  onDismiss: () => void,
): void {
  const latest = useLatest({ isInside, onDismiss });
  useEffect(() => {
    if (!open) return;
    const handle = (event: Event) => {
      const { target } = event;
      if (!(target instanceof Node)) return;
      if (!latest.current.isInside(target)) latest.current.onDismiss();
    };
    document.addEventListener("pointerdown", handle, true);
    document.addEventListener("focusin", handle, true);
    return () => {
      document.removeEventListener("pointerdown", handle, true);
      document.removeEventListener("focusin", handle, true);
    };
  }, [open, latest]);
}
