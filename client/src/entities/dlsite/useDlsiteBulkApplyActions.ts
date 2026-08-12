import { useSetAtom } from "jotai";
import { useMemo } from "react";
import { dlsiteBulkApplyOpenAtom, dlsiteBulkApplyResultAtom } from "./model/bulkAtoms";

export function useDlsiteBulkApplyActions() {
  const setOpen = useSetAtom(dlsiteBulkApplyOpenAtom);
  const setResult = useSetAtom(dlsiteBulkApplyResultAtom);

  return useMemo(
    () => ({
      openDialog: () => setOpen(true),
      dismissResult: () => setResult(null),
    }),
    [setOpen, setResult],
  );
}
