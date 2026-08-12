import { useAtomValue, useSetAtom } from "jotai";
import Toast from "../../shared/ui/Toast";
import { formatDlsiteBulkResult } from "../../features/dlsite/model/formatDlsiteBulkResult";
import {
  dlsiteBulkApplyResultAtom,
  dlsiteBulkCancelledResultAtom,
  dlsiteBulkErrorAtom,
  dlsiteBulkResultAtom,
} from "../../entities/dlsite/model/bulkAtoms";
import { useDlsiteBulkActions } from "../../entities/dlsite/useDlsiteBulkActions";
import { useDlsiteBulkApplyActions } from "../../entities/dlsite/useDlsiteBulkApplyActions";
import { errorToastAtom } from "../../shared/model/errorToastAtom";
import { scanErrorAtom } from "../../entities/scan/model/atoms";
import { useScanActions } from "../../entities/scan/useScanActions";

export default function GlobalToast() {
  const scanError = useAtomValue(scanErrorAtom);
  const errorToast = useAtomValue(errorToastAtom);
  const setErrorToast = useSetAtom(errorToastAtom);
  const dlsiteBulkApplyResult = useAtomValue(dlsiteBulkApplyResultAtom);
  const dlsiteResult = useAtomValue(dlsiteBulkResultAtom);
  const dlsiteCancelledResult = useAtomValue(dlsiteBulkCancelledResultAtom);
  const dlsiteError = useAtomValue(dlsiteBulkErrorAtom);
  const { clearError: clearScanError } = useScanActions();
  const { dismiss: dismissDlsite } = useDlsiteBulkActions();
  const { openDialog: openDlsiteBulkApply, dismissResult: dismissDlsiteBulkApply } =
    useDlsiteBulkApplyActions();

  if (scanError) {
    return <Toast message={scanError} onDismiss={clearScanError} />;
  }

  if (errorToast) {
    return <Toast message={errorToast} onDismiss={() => setErrorToast(null)} />;
  }

  if (dlsiteBulkApplyResult) {
    return <Toast message={dlsiteBulkApplyResult} onDismiss={dismissDlsiteBulkApply} />;
  }

  if (dlsiteCancelledResult) {
    return (
      <Toast
        message={`DLsite一括取得を中断しました（${formatDlsiteBulkResult(dlsiteCancelledResult)}）`}
        onDismiss={dismissDlsite}
      />
    );
  }

  if (dlsiteResult) {
    return (
      <Toast
        message={`DLsite一括取得: ${formatDlsiteBulkResult(dlsiteResult)}`}
        actionLabel="未設定項目を適用"
        onAction={openDlsiteBulkApply}
        onDismiss={dismissDlsite}
      />
    );
  }

  if (dlsiteError) {
    return <Toast message={dlsiteError} onDismiss={dismissDlsite} />;
  }

  return <Toast message={null} onDismiss={dismissDlsite} />;
}
