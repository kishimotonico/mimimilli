import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ScanListStatus } from "../../model/scanListStatus";

export const LOADING_DELAY_MS = 200;
export const LOADING_MIN_VISIBLE_MS = 400;

/** pending は loading になって間もなく、まだ何も描かない期間 */
export type DisplayedScanListStatus = ScanListStatus | "pending";

/**
 * 生の status に、loading の遅延表示と最低表示時間を反映した表示用の status を返す。
 * loading が DELAY 以上続いたときだけ "loading" を出し、出したら最低 MIN_VISIBLE は保つ。
 */
export function useDisplayedScanListStatus(status: ScanListStatus): DisplayedScanListStatus {
  const loading = status === "loading";
  const [visible, setVisible] = useState(false);
  const loadingRef = useRef(loading);
  const shownAt = useRef(0);

  useLayoutEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (loading && !visible) {
      const id = setTimeout(() => {
        if (!loadingRef.current) return;
        shownAt.current = Date.now();
        setVisible(true);
      }, LOADING_DELAY_MS);
      return () => clearTimeout(id);
    }
    if (!loading && visible) {
      const remaining = LOADING_MIN_VISIBLE_MS - (Date.now() - shownAt.current);
      const id = setTimeout(() => setVisible(false), Math.max(0, remaining));
      return () => clearTimeout(id);
    }
  }, [loading, visible]);

  if (visible) return "loading";
  return loading ? "pending" : status;
}
