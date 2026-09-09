import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 結果面（.mll-results）の幅が一覧最低幅とプレビュー最低幅の両方を確保できないとき、
 * プレビューを全幅オーバーレイへ切り替える判定。
 *
 * 閾値は固定pxで書かず、要素が接続されるたびに tokens.css の --lib-results-list-min-w /
 * --lib-results-preview-min-w を読み取って導出する（値の単一の出所をCSS側に置く）。
 */
export function usePreviewOverlayMode() {
  const [isOverlay, setIsOverlay] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!node) {
      setIsOverlay(false);
      return;
    }

    const rootStyle = getComputedStyle(document.documentElement);
    const threshold =
      parseFloat(rootStyle.getPropertyValue("--lib-results-list-min-w")) +
      parseFloat(rootStyle.getPropertyValue("--lib-results-preview-min-w"));

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setIsOverlay(entry.contentRect.width < threshold);
    });
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { ref, isOverlay };
}
