import { useAtomValue } from "jotai";
import Toast from "../../shared/ui/Toast";
import { formatDlsiteBulkResult } from "../../features/dlsite/model/formatDlsiteBulkResult";
import {
  dlsiteBulkCancelledResultAtom,
  dlsiteBulkErrorAtom,
  dlsiteBulkResultAtom,
} from "../../features/dlsite/model/atoms";
import { useDlsiteBulkActions } from "../../features/dlsite/model/useDlsiteBulkActions";
import { scanErrorAtom } from "../../features/scan/model/atoms";
import { useScanActions } from "../../features/scan/model/useScanActions";

export default function GlobalToast() {
  const scanError = useAtomValue(scanErrorAtom);
  const dlsiteResult = useAtomValue(dlsiteBulkResultAtom);
  const dlsiteCancelledResult = useAtomValue(dlsiteBulkCancelledResultAtom);
  const dlsiteError = useAtomValue(dlsiteBulkErrorAtom);
  const { clearError: clearScanError } = useScanActions();
  const { dismiss: dismissDlsite } = useDlsiteBulkActions();

  if (scanError) {
    return <Toast message={scanError} onDismiss={clearScanError} />;
  }

  const message = dlsiteCancelledResult
    ? `DLsite一括取得を中断しました（${formatDlsiteBulkResult(dlsiteCancelledResult)}）`
    : dlsiteResult
      ? `DLsite一括取得: ${formatDlsiteBulkResult(dlsiteResult)}`
      : dlsiteError;

  return <Toast message={message} onDismiss={dismissDlsite} />;
}
