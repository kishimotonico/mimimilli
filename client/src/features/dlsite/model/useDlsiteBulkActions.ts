import { useStore } from "jotai";
import { useMemo } from "react";
import { dlsiteBulkActionsAtom } from "./atoms";

function requireActions(store: ReturnType<typeof useStore>) {
  const actions = store.get(dlsiteBulkActionsAtom);
  if (!actions) {
    throw new Error("DlsiteBulkRuntime が未マウントです（dlsiteBulkActionsAtom が null）");
  }
  return actions;
}

/** DLsite 一括取得の操作のみ。状態 atom は購読しない */
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
