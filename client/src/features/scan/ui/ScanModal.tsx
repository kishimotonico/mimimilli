import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { libraryTotalQueryOptions } from "../../../entities/work/libraryTotalQueryOptions";
import Modal, { ModalHeader } from "../../../shared/ui/Modal";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { cn } from "../../../shared/lib/cn";
import { I } from "../../../shared/ui/Icon";
import { useToast } from "../../../shared/ui/useToast";
import { useScanJobStore, useScanProgress, useScanning } from "../../../entities/scan/useScanJob";
import {
  scanDiagnosticsQueryOptions,
  scanRecordQueryOptions,
} from "../../../entities/scan/queryOptions";
import { useScanCandidatesCache } from "../model/useScanCandidatesCache";
import { useDlsiteNotificationSummary } from "../../../entities/dlsite/model/useDlsiteNotificationSummary";
import ScanSidebar from "./scanModal/ScanSidebar";
import UnregisteredTab from "./scanModal/UnregisteredTab";
import NeedsAttentionTab from "./scanModal/NeedsAttentionTab";
import NewlyRegisteredTab from "./scanModal/NewlyRegisteredTab";
import UpdatedWorksTab from "./scanModal/UpdatedWorksTab";
import ScanFooter from "./scanModal/ScanFooter";
import { useScanCompletionHint } from "./scanModal/useScanCompletionHint";
import { buildNeedsAttentionRows, countNeedsAttention } from "../model/needsAttention";
import type { CandidatesRegisteredResult, ScanTabKey } from "./scanModal/types";

interface ScanModalProps {
  lastScanTime: string | null;
  onClose: () => void;
  /** 開いた時点で選択するタブ。省略時は未登録タブ（通知ベルから要対応タブへ直接遷移するため） */
  initialTab?: ScanTabKey;
  onOpenFiles: (path: string) => void;
}

export default function ScanModal({
  lastScanTime,
  onClose,
  initialTab = "unregistered",
  onOpenFiles,
}: ScanModalProps) {
  const scanning = useScanning();
  const progress = useScanProgress();
  const { start, cancel } = useScanJobStore();
  const [activeTab, setActiveTab] = useState<ScanTabKey>(initialTab);
  const toast = useToast();

  const handleUnregisteredRegistered = ({
    registeredCount,
    failedCount,
    remainingCount,
  }: CandidatesRegisteredResult) => {
    toast.show({
      message:
        failedCount > 0
          ? `${registeredCount}件をライブラリに追加しました。${failedCount}件は追加できませんでした。`
          : `${registeredCount}件をライブラリに追加しました`,
      variant: failedCount > 0 ? "warning" : "success",
      actionLabel: "新規登録済みを見る",
      onAction: () => setActiveTab("newlyRegistered"),
      priority: "action",
    });
    if (remainingCount === 0) setActiveTab("newlyRegistered");
  };

  // 直近のスキャンの記録（サーバーのメモリ。次のスキャンかサーバー再起動まで）。
  const scanRecordQuery = useQuery(scanRecordQueryOptions);
  const scanRecord = scanRecordQuery.data ?? null;

  const candidates = useScanCandidatesCache();

  // 診断はFilesでの解決や登録解除を随時反映する必要があるため、スキャン時点のスナップショットではなく
  // 常に最新を購読する。作品変更後のキャッシュ更新が同じキーを無効化する。
  const diagnosticsQuery = useQuery(scanDiagnosticsQueryOptions);
  const identityConflicts = diagnosticsQuery.data?.identityConflicts ?? [];
  const invalidMetaFiles = diagnosticsQuery.data?.invalidMetaFiles ?? [];
  const dataIntegrityWarning = scanRecord?.dataIntegrityWarning;
  // 通知ベルと同じ「要対応」定義を使うため、RJコード未検出・DLsite取得/パース失敗は
  // スキャン結果のスナップショットではなく通知ベルと同じ集計クエリを参照する。
  const {
    rjCodeMissingCount,
    fetchFailedCount: dlsiteFetchFailedCount,
    parseErrorCount: dlsiteParseErrorCount,
    parseErrorAlert: dlsiteParseErrorAlert,
  } = useDlsiteNotificationSummary();

  const updatedCount = scanRecord?.updatedWorks.length ?? 0;

  // ライブラリ総件数（サイドバーの「ライブラリ N 件」と同じ既存クエリキーを共有する）。
  const libraryTotalQuery = useQuery(libraryTotalQueryOptions);
  const libraryTotal = libraryTotalQuery.data?.total ?? null;

  const { showCompletedHint } = useScanCompletionHint(scanning);

  const needsAttentionRows = buildNeedsAttentionRows({
    identityConflicts,
    invalidMetaFiles,
    rjCodeMissingCount,
    dlsiteFetchFailedCount,
    dlsiteParseErrorCount,
    dlsiteParseErrorAlert,
    dataIntegrityWarning,
  });

  const counts: Partial<Record<ScanTabKey, number>> = {
    unregistered: candidates.length,
    needsAttention: countNeedsAttention(needsAttentionRows),
    updated: updatedCount,
  };

  // スキャン実行中でも閉じられる。スキャン自体はバックグラウンドで継続する。
  const dialog = useDialogModal({ onClose });

  return (
    <Modal dialog={dialog} size={740} height="short" labelledBy="scan-modal-title">
      <ModalHeader
        title="スキャン"
        titleId="scan-modal-title"
        icon={<I.refresh size={14} className={cn("text-ink-3", scanning && "animate-spin")} />}
        onClose={onClose}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ScanSidebar
          active={activeTab}
          onSelect={setActiveTab}
          counts={counts}
          libraryTotal={libraryTotal}
          scanning={scanning}
          progress={progress}
          lastScanTime={lastScanTime}
          showCompletedHint={showCompletedHint}
        />
        <div
          role="tabpanel"
          id={`scan-tabpanel-${activeTab}`}
          aria-labelledby={`scan-tab-${activeTab}`}
          className="min-h-0 flex-1 overflow-y-auto px-[18px] py-4"
        >
          {activeTab === "unregistered" && (
            <UnregisteredTab candidates={candidates} onRegistered={handleUnregisteredRegistered} />
          )}
          {activeTab === "needsAttention" && (
            <NeedsAttentionTab
              identityConflicts={identityConflicts}
              invalidMetaFiles={invalidMetaFiles}
              rjCodeMissingCount={rjCodeMissingCount}
              dlsiteFetchFailedCount={dlsiteFetchFailedCount}
              dlsiteParseErrorCount={dlsiteParseErrorCount}
              dlsiteParseErrorAlert={dlsiteParseErrorAlert}
              dataIntegrityWarning={dataIntegrityWarning}
              onOpenFiles={onOpenFiles}
            />
          )}
          {activeTab === "newlyRegistered" && <NewlyRegisteredTab />}
          {activeTab === "updated" && <UpdatedWorksTab />}
        </div>
      </div>

      <ScanFooter
        scanning={scanning}
        hasResult={scanRecord?.finishedAt != null}
        onCancel={() => void cancel()}
        onFullScan={() => void start({ full: true })}
        onStart={() => void start()}
      />
    </Modal>
  );
}
