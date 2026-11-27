import { useCallback, useState } from "react";

/**
 * Ark UI の Presence は CSS アニメーションしか検知しない。motion の退出が終わるまで
 * 部品の寿命を延ばすため、Root の `present` に渡す値と、AnimatePresence の onExitComplete を返す。
 */
export function usePresenceLifetime(open: boolean) {
  const [exitDone, setExitDone] = useState(true);
  if (open && exitDone) setExitDone(false);
  const onExitComplete = useCallback(() => setExitDone(true), []);
  return { present: open || !exitDone, onExitComplete };
}
