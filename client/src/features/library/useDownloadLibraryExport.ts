import { useCallback } from "react";
import { useToast } from "../../shared/ui/useToast";
import { downloadLibraryExport } from "./model/downloadLibraryExport";

export function useDownloadLibraryExport() {
  const toast = useToast();

  return useCallback(async () => {
    const result = await downloadLibraryExport();
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    if (result.dataIntegrityWarning) {
      toast.error(
        `${result.dataIntegrityWarning.skippedCount}件の作品がデータ不整合のためエクスポートから除外されました`,
      );
    }
  }, [toast]);
}
