import { useEffect } from "react";
import { useLatest } from "../../lib/useLatest";

/** 開いている間、アンカーを含む要素がスクロールしたら閉じる */
export function useCloseOnAnchorScroll(
  open: boolean,
  getAnchor: () => Element | null,
  onClose: () => void,
): void {
  const latest = useLatest({ getAnchor, onClose });
  useEffect(() => {
    if (!open) return;
    const handleScroll = (event: Event) => {
      const anchor = latest.current.getAnchor();
      if (anchor && event.target instanceof Node && event.target.contains(anchor)) {
        latest.current.onClose();
      }
    };
    document.addEventListener("scroll", handleScroll, true);
    return () => document.removeEventListener("scroll", handleScroll, true);
  }, [open, latest]);
}
