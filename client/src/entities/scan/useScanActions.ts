import type { StartScanRequest } from "@mimimilli/shared";
import { useStore } from "jotai";
import { useMemo } from "react";
import { scanActionsAtom } from "./model/atoms";

function requireActions(store: ReturnType<typeof useStore>) {
  const actions = store.get(scanActionsAtom);
  if (!actions) {
    throw new Error("ScanRuntime が未マウントです（scanActionsAtom が null）");
  }
  return actions;
}

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
