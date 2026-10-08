import { useCallback, useSyncExternalStore } from "react";
import type { ReadableStore } from "./externalStore";

/** selector は同じ state に対して同じ参照（またはプリミティブ）を返すこと。 */
export function useStoreSelector<S, T>(store: ReadableStore<S>, selector: (state: S) => T): T {
  const getSnapshot = useCallback(() => selector(store.getState()), [selector, store]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
