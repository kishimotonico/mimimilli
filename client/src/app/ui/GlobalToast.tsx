import { useAtomValue, useSetAtom } from "jotai";
import Toast from "../../shared/ui/Toast";
import { formatDlsiteBulkResult } from "../../features/dlsite/model/formatDlsiteBulkResult";
import {
  dlsiteBulkCancelledResultAtom,
  dlsiteBulkErrorAtom,
  dlsiteBulkResultAtom,
} from "../../entities/dlsite/model/bulkAtoms";
import { useDlsiteBulkActions } from "../../entities/dlsite/useDlsiteBulkActions";
import { errorToastAtom } from "../../shared/model/errorToastAtom";
import { scanErrorAtom } from "../../entities/scan/model/atoms";
import { useScanActions } from "../../entities/scan/useScanActions";

export default function GlobalToast() {
  const scanError = useAtomValue(scanErrorAtom);
  const errorToast = useAtomValue(errorToastAtom);
  const setErrorToast = useSetAtom(errorToastAtom);
  const dlsiteResult = useAtomValue(dlsiteBulkResultAtom);
  const dlsiteCancelledResult = useAtomValue(dlsiteBulkCancelledResultAtom);
  const dlsiteError = useAtomValue(dlsiteBulkErrorAtom);
  const { clearError: clearScanError } = useScanActions();
  const { dismiss: dismissDlsite } = useDlsiteBulkActions();

  if (scanError) {
    return <Toast message={scanError} onDismiss={clearScanError} />;
  }

  if (errorToast) {
    return <Toast message={errorToast} onDismiss={() => setErrorToast(null)} />;
  }

  const message = dlsiteCancelledResult
    ? `DLsite一括取得を中断しました（${formatDlsiteBulkResult(dlsiteCancelledResult)}）`
    : dlsiteResult
      ? `DLsite一括取得: ${formatDlsiteBulkResult(dlsiteResult)}`
      : dlsiteError;

  return <Toast message={message} onDismiss={dismissDlsite} />;
}
