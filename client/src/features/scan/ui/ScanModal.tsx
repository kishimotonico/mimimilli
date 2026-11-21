import type { WorkspacePath } from "@mimimilli/shared";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import Modal, { ModalHeader } from "../../../shared/ui/Modal";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { cn } from "../../../shared/lib/cn";
import { I } from "../../../shared/ui/Icon";
import { useToast } from "../../../shared/ui/useToast";
import { useScanJobStore, useScanning } from "../../../entities/scan/useScanJob";
import { scanResultsRefreshedAtom } from "../../../entities/scan/model/atoms";
import { scanRecordQueryOptions } from "../../../entities/scan/queryOptions";
import { scanNewCountQueryOptions } from "../../../entities/work/scanNewCountQueryOptions";
import { useScanCandidatesState } from "../model/useScanCandidatesCache";
import { formatWorkNames } from "../model/formatWorkNames";
import ScanSidebar from "./scanModal/ScanSidebar";
import UnregisteredTab from "./scanModal/unregistered/UnregisteredTab";
import NeedsAttentionTab from "./scanModal/NeedsAttentionTab";
import NewWorksTab from "./scanModal/newWorks/NewWorksTab";
import UpdatedWorksTab from "./scanModal/updated/UpdatedWorksTab";
import { useNeedsAttentionRows } from "../model/useNeedsAttentionRows";
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

  const candidates = useScanCandidatesState();

  const needsAttention = useNeedsAttentionRows();
  const recordQuery = useQuery(scanRecordQueryOptions);
  const newCountQuery = useQuery(scanNewCountQueryOptions);

  const counts = computeScanTabCounts({
    candidates: candidates.response ?? undefined,
    needsAttention: needsAttention.rows?.length,
    newCount: newCountQuery.data,
    record: recordQuery.data,
  });
  const countsSettled =
    candidates.status !== "loading" &&
    !needsAttention.loading &&
    !recordQuery.isPending &&
    !newCountQuery.isPending;
  const [activeTab, setActiveTab] = useActiveTab(counts, countsSettled);

  const handleUnregisteredRegistered = ({
    registeredTitles,
    coverSkippedTitles,
    failedCount,
    remainingCandidates,
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
    if (remainingCandidates === 0) setActiveTab("newWorks");
  };

  const scanPending = recordQuery.data !== undefined && recordQuery.data.finishedAt === null;

  // スキャン実行中でも閉じられる。スキャン自体はバックグラウンドで継続する。
  const dialog = useDialogModal({ onClose });

  return (
    <Modal dialog={dialog} size={960} height="fixed" labelledBy="scan-modal-title">
      <ModalHeader
        title="スキャン"
        titleId="scan-modal-title"
        icon={<I.refresh size={15} className={cn("text-ink-2", scanning && "animate-spin")} />}
        onClose={onClose}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ScanSidebar
          active={activeTab}
          onSelect={setActiveTab}
          counts={counts}
          lastScanTime={lastScanTime}
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
              onRegistered={handleUnregisteredRegistered}
              onOpenFiles={onOpenFiles}
            />
          )}
          {activeTab === "needsAttention" && (
            <NeedsAttentionTab onOpenFiles={onOpenFiles} onOpenWorkDetail={onOpenWorkDetail} />
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
