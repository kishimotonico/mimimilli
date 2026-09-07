import { useAtomValue, useSetAtom } from "jotai";
import Toast from "../../shared/ui/Toast";
import { formatDlsiteBulkResult } from "../../features/dlsite/model/formatDlsiteBulkResult";
import { formatScanResult } from "../../features/scan/model/formatScanResult";
import {
  dlsiteBulkApplyResultAtom,
  dlsiteBulkCancelledResultAtom,
  dlsiteBulkErrorAtom,
  dlsiteBulkResultAtom,
} from "../../entities/dlsite/model/bulkAtoms";
import { dlsiteApplyToastAtom } from "../../entities/dlsite/model/dlsiteApplyToastAtom";
import { useDlsiteBulkActions } from "../../entities/dlsite/useDlsiteBulkActions";
import { useDlsiteBulkApplyActions } from "../../entities/dlsite/useDlsiteBulkApplyActions";
import { errorToastAtom } from "../../shared/model/errorToastAtom";
import { scanErrorAtom, scanResultToastAtom } from "../../entities/scan/model/atoms";
import { useScanActions } from "../../entities/scan/useScanActions";
import { playerSkipToastAtom } from "../../features/player/model/playerPresentationAtoms";
import { rootFolderChangedToastAtom } from "../../entities/settings/model/rootFolderChangeAtoms";
import {
  libraryInvalidUrlToastAtom,
  workDeleteSuccessAtom,
} from "../../features/library/model/atoms";
import { copyPathSuccessAtom } from "../../features/files/model/atoms";

export interface GlobalToastProps {
  /** ルートフォルダー変更成功トーストの「今すぐスキャン」actionから呼ぶ */
  onOpenScan: () => void;
  /** スキャン完了トーストの「要対応を見る」からスキャンモーダルの要対応タブを開く（TASK-428.4） */
  onOpenScanNeedsAttention: () => void;
  /** トラックスキップ通知の「このトラックを再試行」から、該当トラックを選択し直す */
  onRetrySkippedTrack: (trackIndex: number) => void;
}

export default function GlobalToast({
  onOpenScan,
  onOpenScanNeedsAttention,
  onRetrySkippedTrack,
}: GlobalToastProps) {
  const scanError = useAtomValue(scanErrorAtom);
  const scanResultToast = useAtomValue(scanResultToastAtom);
  const setScanResultToast = useSetAtom(scanResultToastAtom);
  const errorToast = useAtomValue(errorToastAtom);
  const setErrorToast = useSetAtom(errorToastAtom);
  const rootFolderChangedToast = useAtomValue(rootFolderChangedToastAtom);
  const setRootFolderChangedToast = useSetAtom(rootFolderChangedToastAtom);
  const playerSkipToast = useAtomValue(playerSkipToastAtom);
  const setPlayerSkipToast = useSetAtom(playerSkipToastAtom);
  const libraryInvalidUrlToast = useAtomValue(libraryInvalidUrlToastAtom);
  const setLibraryInvalidUrlToast = useSetAtom(libraryInvalidUrlToastAtom);
  const workDeleteSuccess = useAtomValue(workDeleteSuccessAtom);
  const setWorkDeleteSuccess = useSetAtom(workDeleteSuccessAtom);
  const dlsiteApplyToast = useAtomValue(dlsiteApplyToastAtom);
  const setDlsiteApplyToast = useSetAtom(dlsiteApplyToastAtom);
  const copyPathSuccess = useAtomValue(copyPathSuccessAtom);
  const setCopyPathSuccess = useSetAtom(copyPathSuccessAtom);
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

  if (scanResultToast) {
    const dismissScanResultToast = () => setScanResultToast(null);
    if (scanResultToast.kind === "cancelled") {
      return (
        <Toast
          message="スキャンを中止しました"
          variant="warning"
          onDismiss={dismissScanResultToast}
        />
      );
    }
    const { result } = scanResultToast;
    const hasNeedsAttention =
      result.identityConflicts.length > 0 ||
      result.invalidMetaFiles.length > 0 ||
      result.rjCodeMissingCount > 0 ||
      result.dataIntegrityWarning !== undefined;
    return (
      <Toast
        message={`スキャン完了: ${formatScanResult(result)}`}
        variant={result.errors > 0 || result.missing > 0 ? "warning" : "success"}
        actionLabel={hasNeedsAttention ? "要対応を見る" : undefined}
        onAction={
          hasNeedsAttention
            ? () => {
                onOpenScanNeedsAttention();
                dismissScanResultToast();
              }
            : undefined
        }
        onDismiss={dismissScanResultToast}
      />
    );
  }

  if (errorToast) {
    return <Toast message={errorToast} variant="error" onDismiss={() => setErrorToast(null)} />;
  }

  if (rootFolderChangedToast) {
    return (
      <Toast
        message="ルートフォルダーを変更しました。新しいフォルダーを読み込むにはスキャンしてください。"
        variant="success"
        actionLabel="今すぐスキャン"
        onAction={onOpenScan}
        onDismiss={() => setRootFolderChangedToast(false)}
      />
    );
  }

  if (playerSkipToast) {
    return (
      <Toast
        message={playerSkipToast.message}
        variant="warning"
        actionLabel="このトラックを再試行"
        onAction={() => {
          onRetrySkippedTrack(playerSkipToast.trackIndex);
          setPlayerSkipToast(null);
        }}
        onDismiss={() => setPlayerSkipToast(null)}
      />
    );
  }

  if (libraryInvalidUrlToast) {
    return (
      <Toast
        message={libraryInvalidUrlToast}
        variant="warning"
        onDismiss={() => setLibraryInvalidUrlToast(null)}
      />
    );
  }

  if (workDeleteSuccess) {
    return (
      <Toast
        message={workDeleteSuccess}
        variant="success"
        onDismiss={() => setWorkDeleteSuccess(null)}
      />
    );
  }

  if (dlsiteApplyToast) {
    return (
      <Toast
        message={dlsiteApplyToast.message}
        variant={dlsiteApplyToast.variant}
        onDismiss={() => setDlsiteApplyToast(null)}
      />
    );
  }

  if (copyPathSuccess) {
    return (
      <Toast
        message={copyPathSuccess}
        variant="success"
        onDismiss={() => setCopyPathSuccess(null)}
      />
    );
  }

  if (dlsiteBulkApplyResult) {
    return (
      <Toast
        message={dlsiteBulkApplyResult.message}
        variant={dlsiteBulkApplyResult.variant}
        onDismiss={dismissDlsiteBulkApply}
      />
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
