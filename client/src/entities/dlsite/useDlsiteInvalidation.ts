import { useStore } from "jotai";
import { useMemo } from "react";
import { dlsiteInvalidateAtom } from "./model/bulkAtoms";

export function useDlsiteInvalidation() {
  const store = useStore();

  return useMemo(
    () => async (workIds?: string | string[]) => {
      const invalidate = store.get(dlsiteInvalidateAtom);
      if (!invalidate) {
        throw new Error("DlsiteBulkRuntime が未マウントです（dlsiteInvalidateAtom が null）");
      }
      await invalidate(workIds);
    },
    [store],
  );
}
