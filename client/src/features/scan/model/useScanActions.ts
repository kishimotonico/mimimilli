import type { StartScanRequest } from "@mimimilli/shared";
import { useStore } from "jotai";
import { useMemo } from "react";
import { scanActionsAtom } from "./atoms";

function requireActions(store: ReturnType<typeof useStore>) {
  const actions = store.get(scanActionsAtom);
  if (!actions) {
    throw new Error("ScanRuntime が未マウントです（scanActionsAtom が null）");
  }
  return actions;
}

/** スキャンの操作のみ。状態 atom は購読しない */
export function useScanActions() {
  const store = useStore();

  return useMemo(
    () => ({
      start: (options?: StartScanRequest) => requireActions(store).start(options),
      cancel: () => requireActions(store).cancel(),
      clearError: () => requireActions(store).clearError(),
    }),
    [store],
  );
}
