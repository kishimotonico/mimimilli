import { useStore } from "jotai";
import { useMemo } from "react";
import { dlsiteBulkActionsAtom } from "./model/bulkAtoms";

function requireActions(store: ReturnType<typeof useStore>) {
  const actions = store.get(dlsiteBulkActionsAtom);
  if (!actions) {
    throw new Error("DlsiteBulkRuntime が未マウントです（dlsiteBulkActionsAtom が null）");
  }
  return actions;
}

export function useDlsiteBulkActions() {
  const store = useStore();

  return useMemo(
    () => ({
      start: () => requireActions(store).start(),
      attach: () => requireActions(store).attach(),
      cancel: () => requireActions(store).cancel(),
      dismiss: () => requireActions(store).dismiss(),
    }),
    [store],
  );
}
