import type { WorkspacePath } from "@mimimilli/shared";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Modal, { ModalHeader } from "../../../shared/ui/Modal";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { cn } from "../../../shared/lib/cn";
import { I } from "../../../shared/ui/Icon";
import { useToast } from "../../../shared/ui/useToast";
import { useScanJobStore, useScanning } from "../../../entities/scan/useScanJob";
import { scanDiagnosticsQueryOptions } from "../../../entities/scan/queryOptions";
import { useScanCandidatesCache } from "../model/useScanCandidatesCache";
import ScanSidebar from "./scanModal/ScanSidebar";
import UnregisteredTab from "./scanModal/unregistered/UnregisteredTab";
import NeedsAttentionTab from "./scanModal/NeedsAttentionTab";
import NewWorksTab from "./scanModal/newWorks/NewWorksTab";
import UpdatedWorksTab from "./scanModal/updated/UpdatedWorksTab";
import { useScanStatusView } from "./scanModal/useScanStatusView";
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
  const { start, cancel } = useScanJobStore();
  const [activeTab, setActiveTab] = useState<ScanTabKey>("unregistered");
  const toast = useToast();

  const handleUnregisteredRegistered = ({
    registeredCount,
    failedCount,
    coverSkippedCount,
    interrupted,
  }: CandidatesRegisteredResult) => {
    if (registeredCount === 0) return;
    const coverNote =
      coverSkippedCount > 0 ? `うち${coverSkippedCount}件はカバーを適用できませんでした。` : "";
    if (failedCount > 0 || interrupted) {
      toast.show({
        message:
          (interrupted
            ? `${registeredCount}件を追加して止まりました。`
            : `${registeredCount}件を追加しました。${failedCount}件は追加できず、未登録タブに残っています。`) +
          coverNote,
        variant: "warning",
        priority: "notice",
      });
      return;
    }
    if (coverNote) {
      toast.show({
        message: `${registeredCount}件を追加しました。${coverNote}`,
        variant: "warning",
        priority: "notice",
      });
    }
    setActiveTab("newWorks");
  };

  const candidates = useScanCandidatesCache();

  // 診断はFilesでの解決や登録解除を随時反映する必要があるため、スキャン時点のスナップショットではなく
  // 常に最新を購読する。作品変更後のキャッシュ更新が同じキーを無効化する。
  const diagnosticsQuery = useQuery(scanDiagnosticsQueryOptions);

  const statusView = useScanStatusView(lastScanTime);

  const needsAttentionRows = buildNeedsAttentionRows(diagnosticsQuery.data);

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
          status={statusView}
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
              loading={diagnosticsQuery.isPending}
              error={diagnosticsQuery.isError}
              onRetry={() => void diagnosticsQuery.refetch()}
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
