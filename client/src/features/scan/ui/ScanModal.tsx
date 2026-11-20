import type { WorkspacePath } from "@mimimilli/shared";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import Modal, { ModalHeader } from "../../../shared/ui/Modal";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { cn } from "../../../shared/lib/cn";
import { I } from "../../../shared/ui/Icon";
import { useToast } from "../../../shared/ui/useToast";
import { useScanJobStore, useScanning } from "../../../entities/scan/useScanJob";
import { scanResultsRefreshedAtom } from "../../../entities/scan/model/atoms";
import {
  scanDiagnosticsQueryOptions,
  scanRecordQueryOptions,
} from "../../../entities/scan/queryOptions";
import { refreshScanCandidates } from "../../../entities/scan/scanCandidatesCache";
import { scanNewCountQueryOptions } from "../../../entities/work/scanNewCountQueryOptions";
import { useScanCandidatesState } from "../model/useScanCandidatesCache";
import { formatWorkNames } from "../model/formatWorkNames";
import { deriveScanListStatus } from "../model/scanListStatus";
import ScanSidebar from "./scanModal/ScanSidebar";
import UnregisteredTab from "./scanModal/unregistered/UnregisteredTab";
import NeedsAttentionTab from "./scanModal/NeedsAttentionTab";
import NewWorksTab from "./scanModal/newWorks/NewWorksTab";
import UpdatedWorksTab from "./scanModal/updated/UpdatedWorksTab";
import { useScanStatusView } from "./scanModal/useScanStatusView";
import { buildNeedsAttentionRows } from "../model/needsAttention";
import { computeScanTabCounts, landingTab, type ScanTabCounts } from "./scanModal/scanTabs";
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
  const toast = useToast();

  const queryClient = useQueryClient();
  const candidates = useScanCandidatesState();

  // 診断はFilesでの解決や登録解除を随時反映する必要があるため、スキャン時点のスナップショットではなく
  // 常に最新を購読する。作品変更後のキャッシュ更新が同じキーを無効化する。
  const diagnosticsQuery = useQuery(scanDiagnosticsQueryOptions);
  const recordQuery = useQuery(scanRecordQueryOptions);
  const newCountQuery = useQuery(scanNewCountQueryOptions);

  const statusView = useScanStatusView(lastScanTime);

  const needsAttentionRows = buildNeedsAttentionRows(diagnosticsQuery.data);

  const counts = computeScanTabCounts({
    candidates: candidates.response ?? undefined,
    diagnostics: diagnosticsQuery.data,
    newCount: newCountQuery.data,
    record: recordQuery.data,
  });
  const countsSettled =
    candidates.status !== "loading" &&
    !diagnosticsQuery.isPending &&
    !recordQuery.isPending &&
    !newCountQuery.isPending;
  const [activeTab, setActiveTab] = useActiveTab(counts, countsSettled);

  const handleUnregisteredRegistered = ({
    registeredTitles,
    coverSkippedTitles,
    failedCount,
    remainingCount,
    interrupted,
  }: CandidatesRegisteredResult) => {
    if (registeredTitles.length === 0) return;
    const names = formatWorkNames(registeredTitles);
    const coverNote =
      coverSkippedTitles.length > 0
        ? `${formatWorkNames(coverSkippedTitles)}はカバーを適用できませんでした。`
        : "";
    if (failedCount > 0 || interrupted) {
      toast.show({
        message:
          (interrupted
            ? `${names}を追加して止まりました。`
            : `${names}を追加しました。${failedCount}件は追加できず、未登録タブに残っています。`) +
          coverNote,
        variant: "warning",
        priority: "notice",
      });
      return;
    }
    toast.show({
      message: `${names}を追加しました。${coverNote}`,
      variant: coverNote ? "warning" : "success",
      priority: "notice",
    });
    if (remainingCount <= 0) setActiveTab("newWorks");
  };

  const retryCandidates = () => void refreshScanCandidates(queryClient).catch(() => undefined);
  const candidatesStatus = deriveScanListStatus({
    loading: candidates.status === "loading",
    error: candidates.status === "error",
    notScanned: !candidates.scanCompleted,
    count: candidates.candidates.length,
  });
  const scanPending = recordQuery.data !== undefined && recordQuery.data.finishedAt === null;

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
          scanPending={scanPending}
          onStart={() => void start()}
          onFullScan={() => void start({ full: true })}
          onCancel={() => void cancel()}
        />
        <div
          role="tabpanel"
          id={activeTab ? `scan-tabpanel-${activeTab}` : undefined}
          aria-labelledby={activeTab ? `scan-tab-${activeTab}` : undefined}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {activeTab === "unregistered" && (
            <UnregisteredTab
              candidates={candidates.candidates}
              status={candidatesStatus}
              onRetry={retryCandidates}
              onRegistered={handleUnregisteredRegistered}
            />
          )}
          {activeTab === "needsAttention" && (
            <NeedsAttentionTab
              rows={needsAttentionRows}
              loading={diagnosticsQuery.isPending}
              error={diagnosticsQuery.isError && diagnosticsQuery.data === undefined}
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

/** 開いたときは件数のあるタブへ着地する。件数がそろうまでは、どのタブも選ばない。
 *  スキャン完了後は、今のタブが空のときだけ同じ規則で移る。 */
function useActiveTab(
  counts: ScanTabCounts,
  settled: boolean,
): [ScanTabKey | null, (tab: ScanTabKey) => void] {
  const [tab, setTab] = useState<ScanTabKey | null>(() => (settled ? landingTab(counts) : null));
  const refreshed = useAtomValue(scanResultsRefreshedAtom);
  const seenRefreshed = useRef(refreshed);

  useEffect(() => {
    if (tab === null && settled) setTab(landingTab(counts));
  }, [tab, settled, counts]);

  useEffect(() => {
    if (seenRefreshed.current === refreshed) return;
    seenRefreshed.current = refreshed;
    if (tab !== null && counts[tab] === 0) setTab(landingTab(counts));
  }, [refreshed, tab, counts]);

  return [tab, setTab];
}
