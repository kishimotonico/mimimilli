import { useEffect, useLayoutEffect, useRef, useState } from "react";

export const LOADING_DELAY_MS = 200;
export const LOADING_MIN_VISIBLE_MS = 400;

/** pending は読み込みが始まって間もない期間、visible は読み込み表示を出している期間 */
export type DelayedLoading = "hidden" | "pending" | "visible";

/**
 * 読み込み中の表示を、短い読み込みでは出さず、出したら最低時間は保つ。
 * loading が DELAY 以上続いたときだけ visible になり、出したあとは MIN_VISIBLE まで visible のまま。
 */
export function useDelayedLoading(loading: boolean): DelayedLoading {
  const [visible, setVisible] = useState(false);
  const loadingRef = useRef(loading);
  const shownAt = useRef(0);

  // コミットから passive effect の cleanup までのあいだにタイマーが発火しても、終わった読み込みを出さない
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

  if (visible) return "visible";
  return loading ? "pending" : "hidden";
}
