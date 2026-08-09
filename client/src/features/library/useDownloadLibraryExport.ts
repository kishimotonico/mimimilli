import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { errorToastAtom } from "../../shared/model/errorToastAtom";
import { downloadLibraryExport } from "./model/downloadLibraryExport";

export function useDownloadLibraryExport() {
  const setErrorToast = useSetAtom(errorToastAtom);

  return useCallback(async () => {
    const result = await downloadLibraryExport();
    if (!result.ok) {
      setErrorToast(result.message);
      return;
    }
    if (result.dataIntegrityWarning) {
      setErrorToast(
        `${result.dataIntegrityWarning.skippedCount}件の作品がデータ不整合のためエクスポートから除外されました`,
      );
    }
  }, [setErrorToast]);
}
