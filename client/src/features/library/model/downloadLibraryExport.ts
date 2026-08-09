import { exportLibrary } from "../api";
import { apiErrorMessage } from "../../../shared/lib/apiError";

export type DownloadLibraryExportResult =
  | { ok: true; dataIntegrityWarning?: { skippedCount: number } }
  | { ok: false; message: string };

export async function downloadLibraryExport(): Promise<DownloadLibraryExportResult> {
  try {
    const exported = await exportLibrary();
    const blob = new Blob([exported.data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mimimilli-export.json";
    a.click();
    URL.revokeObjectURL(url);
    return {
      ok: true,
      dataIntegrityWarning: exported.dataIntegrityWarning,
    };
  } catch (err) {
    return {
      ok: false,
      message: apiErrorMessage(err, "ライブラリのエクスポートに失敗しました"),
    };
  }
}
