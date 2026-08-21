import { useCallback, type RefObject } from "react";

/** trackRef の要素の左端からの clientX 位置を 0-1 の比率に変換する（シークバー・ABハンドル共通）。 */
export function useRatioFromClientX(
  trackRef: RefObject<HTMLDivElement | null>,
): (clientX: number) => number {
  return useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return 0;
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    [trackRef],
  );
}
