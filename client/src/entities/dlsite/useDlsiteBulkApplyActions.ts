import { useSetAtom } from "jotai";
import { useMemo } from "react";
import { dlsiteBulkApplyOpenAtom } from "./model/bulkAtoms";

export function useDlsiteBulkApplyActions() {
  const setOpen = useSetAtom(dlsiteBulkApplyOpenAtom);

  return useMemo(() => ({ openDialog: () => setOpen(true) }), [setOpen]);
}
