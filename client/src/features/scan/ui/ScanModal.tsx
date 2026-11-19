import type { WorkspacePath } from "@mimimilli/shared";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import ScanSidebar from "./scanModal/ScanSidebar";
import UnregisteredTab from "./scanModal/unregistered/UnregisteredTab";
import NeedsAttentionTab from "./scanModal/NeedsAttentionTab";
import NewWorksTab from "./scanModal/newWorks/NewWorksTab";
import UpdatedWorksTab from "./scanModal/updated/UpdatedWorksTab";
import { useScanCompletionHint } from "./scanModal/useScanCompletionHint";
import { buildNeedsAttentionRows, countNeedsAttention } from "../model/needsAttention";
import type { CandidatesRegisteredResult, ScanTabKey } from "./scanModal/types";

interface ScanModalProps {
  lastScanTime: string | null;
  onClose: () => void;
  onOpenFiles: (path: WorkspacePath) => void;
  onOpenWorkDetail: (workId: string) => void;
}

export default function ScanModal({
  lastScanTime,
  onClose,
  onOpenFiles,
  onOpenWorkDetail,
}: ScanModalProps) {
  const scanning = useScanning();
  const progress = useScanProgress();
  const { start, cancel } = useScanJobStore();
  const [activeTab, setActiveTab] = useState<ScanTabKey>("unregistered");
  const toast = useToast();

  const handleUnregisteredRegistered = ({
    registeredCount,
    failedCount,
    interrupted,
  }: CandidatesRegisteredResult) => {
    if (failedCount > 0 || interrupted) {
      toast.show({
        message: interrupted
          ? `${registeredCount}件を追加して止まりました。残りは未登録タブから追加してください。`
          : `${registeredCount}件を追加しました。${failedCount}件は追加できませんでした。`,
        variant: "warning",
        priority: "notice",
      });
    }
    setActiveTab("newWorks");
  };

  // 直近のスキャンの記録（サーバーのメモリ。次のスキャンかサーバー再起動まで）。
  const scanRecordQuery = useQuery(scanRecordQueryOptions);

  const candidates = useScanCandidatesCache();

  // 診断はFilesでの解決や登録解除を随時反映する必要があるため、スキャン時点のスナップショットではなく
  // 常に最新を購読する。作品変更後のキャッシュ更新が同じキーを無効化する。
  const diagnosticsQuery = useQuery(scanDiagnosticsQueryOptions);

  const { showCompletedHint } = useScanCompletionHint(scanning);

  const needsAttentionRows = buildNeedsAttentionRows({
    diagnostics: diagnosticsQuery.data,
    record: scanRecordQuery.data,
  });

  const counts: Partial<Record<ScanTabKey, number>> = {
    unregistered: candidates.length,
    needsAttention: countNeedsAttention(needsAttentionRows),
  };

  // スキャン実行中でも閉じられる。スキャン自体はバックグラウンドで継続する。
  const dialog = useDialogModal({ onClose });

  return (
    <Modal dialog={dialog} size={960} height="fixed" labelledBy="scan-modal-title">
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
          scanning={scanning}
          progress={progress}
          lastScanTime={lastScanTime}
          showCompletedHint={showCompletedHint}
          onStart={() => void start()}
          onFullScan={() => void start({ full: true })}
          onCancel={() => void cancel()}
        />
        <div
          role="tabpanel"
          id={`scan-tabpanel-${activeTab}`}
          aria-labelledby={`scan-tab-${activeTab}`}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {activeTab === "unregistered" && (
            <UnregisteredTab candidates={candidates} onRegistered={handleUnregisteredRegistered} />
          )}
          {activeTab === "needsAttention" && (
            <NeedsAttentionTab
              rows={needsAttentionRows}
              loading={diagnosticsQuery.isPending || scanRecordQuery.isPending}
              error={diagnosticsQuery.isError || scanRecordQuery.isError}
              onRetry={() => {
                if (diagnosticsQuery.isError) void diagnosticsQuery.refetch();
                if (scanRecordQuery.isError) void scanRecordQuery.refetch();
              }}
              onOpenFiles={onOpenFiles}
              onOpenWorkDetail={onOpenWorkDetail}
            />
          )}
          {activeTab === "newWorks" && (
            <NewWorksTab onOpenFiles={onOpenFiles} onOpenWorkDetail={onOpenWorkDetail} />
          )}
          {activeTab === "updated" && (
            <UpdatedWorksTab onOpenFiles={onOpenFiles} onOpenWorkDetail={onOpenWorkDetail} />
          )}
        </div>
      </div>
    </Modal>
  );
}
