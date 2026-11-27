import { useEffect } from "react";
import { useIsPresent } from "motion/react";
import { useLatest } from "../../lib/useLatest";

/** AnimatePresence の退出に入った親の中から、開いている層を閉じる */
export function useCloseOnParentExit(enabled: boolean, open: boolean, close: () => void): void {
  const isPresent = useIsPresent();
  const closeRef = useLatest(close);
  useEffect(() => {
    if (enabled && !isPresent && open) closeRef.current();
  }, [enabled, isPresent, open, closeRef]);
}
