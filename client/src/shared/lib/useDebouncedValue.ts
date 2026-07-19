import { useEffect, useState } from "react";

/** 値の反映を delayMs だけ遅らせるデバウンスフック。
 *  immediate が true の間は待機なしで即時反映する（検索クリアの即時反映などに使う）。 */
export function useDebouncedValue<T>(value: T, delayMs: number, immediate = false): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (immediate) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, immediate]);

  return debounced;
}
