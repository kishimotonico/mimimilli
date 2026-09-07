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
import { playerSkipToastAtom } from "../../features/player/model/playerPresentationAtoms";

export default function GlobalToast() {
  const scanError = useAtomValue(scanErrorAtom);
  const errorToast = useAtomValue(errorToastAtom);
  const setErrorToast = useSetAtom(errorToastAtom);
  const playerSkipToast = useAtomValue(playerSkipToastAtom);
  const setPlayerSkipToast = useSetAtom(playerSkipToastAtom);
  const dlsiteBulkApplyResult = useAtomValue(dlsiteBulkApplyResultAtom);
  const dlsiteResult = useAtomValue(dlsiteBulkResultAtom);
  const dlsiteCancelledResult = useAtomValue(dlsiteBulkCancelledResultAtom);
  const dlsiteError = useAtomValue(dlsiteBulkErrorAtom);
  const { clearError: clearScanError } = useScanActions();
  const { dismiss: dismissDlsite } = useDlsiteBulkActions();
  const { openDialog: openDlsiteBulkApply, dismissResult: dismissDlsiteBulkApply } =
    useDlsiteBulkApplyActions();

  if (scanError) {
    return <Toast message={scanError} variant="error" onDismiss={clearScanError} />;
  }

  if (errorToast) {
    return <Toast message={errorToast} variant="error" onDismiss={() => setErrorToast(null)} />;
  }

  if (playerSkipToast) {
    return (
      <Toast
        message={playerSkipToast}
        variant="warning"
        onDismiss={() => setPlayerSkipToast(null)}
      />
    );
  }

  if (dlsiteBulkApplyResult) {
    return (
      <Toast message={dlsiteBulkApplyResult} variant="success" onDismiss={dismissDlsiteBulkApply} />
    );
  }

  if (dlsiteCancelledResult) {
    return (
      <Toast
        message={`DLsite一括取得を中断しました（${formatDlsiteBulkResult(dlsiteCancelledResult)}）`}
        variant="warning"
        onDismiss={dismissDlsite}
      />
    );
  }

  if (dlsiteResult) {
    return (
      <Toast
        message={`DLsite一括取得: ${formatDlsiteBulkResult(dlsiteResult)}`}
        variant={dlsiteResult.failed > 0 ? "warning" : "success"}
        actionLabel="未設定項目を適用"
        onAction={openDlsiteBulkApply}
        onDismiss={dismissDlsite}
      />
    );
  }

  if (dlsiteError) {
    return <Toast message={dlsiteError} variant="error" onDismiss={dismissDlsite} />;
  }

  return <Toast message={null} onDismiss={dismissDlsite} />;
}
