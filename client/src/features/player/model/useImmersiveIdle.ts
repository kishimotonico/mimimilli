import { useEffect, useState } from "react";

/** 没入モードで無操作が続いたとき、切替アイコン・タイトルをフェードアウトするまでの時間（ms）。 */
export const NOW_PLAYING_IMMERSIVE_IDLE_MS = 3000;

/**
 * active な間、マウス移動・キー操作が timeoutMs 途絶えたら true を返す。
 * キー操作は capture フェーズで拾うため、AB ハンドルの矢印キー操作（stopPropagation
 * される）でも復帰を検知できる。
 */
export function useImmersiveIdle(
  active: boolean,
  timeoutMs: number = NOW_PLAYING_IMMERSIVE_IDLE_MS,
): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (!active) {
      setIdle(false);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), timeoutMs);
    };
    reset();

    window.addEventListener("mousemove", reset, true);
    window.addEventListener("keydown", reset, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", reset, true);
      window.removeEventListener("keydown", reset, true);
    };
  }, [active, timeoutMs]);

  return idle;
}
