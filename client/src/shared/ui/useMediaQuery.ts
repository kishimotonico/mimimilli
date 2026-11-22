import { useCallback, useSyncExternalStore } from "react";

/** ADR-0006 の 768px の単一分岐。これより狭い幅がモバイル */
export const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
