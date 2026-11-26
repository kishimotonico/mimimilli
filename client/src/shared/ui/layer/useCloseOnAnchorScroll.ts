import { useEffect } from "react";

export function useCloseOnAnchorScroll(
  open: boolean,
  getAnchor: () => Element | null,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    const handleScroll = (event: Event) => {
      const anchor = getAnchor();
      if (anchor && event.target instanceof Node && event.target.contains(anchor)) onClose();
    };
    document.addEventListener("scroll", handleScroll, true);
    return () => document.removeEventListener("scroll", handleScroll, true);
  }, [open, getAnchor, onClose]);
}
