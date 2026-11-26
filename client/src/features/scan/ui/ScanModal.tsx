import { isFocusLost } from "../../../shared/lib/focusReturnTarget";
import type { WorkspacePath } from "@mimimilli/shared";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  computeScanTabCounts,
  landingTab,
  type ScanTabCounts,
  type ScanTabPending,
} from "./scanModal/scanTabs";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import { useDelayedLoading } from "../../../shared/ui/useDelayedLoading";
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
  const pending: ScanTabPending = {
    unregistered: candidates.status === "loading",
    needsAttention: needsAttention.loading,
    newWorks: newCountQuery.isPending,
    updated: recordQuery.isPending,
  };
  const [activeTab, setActiveTab] = useActiveTab(counts, pending);
  const landingLoading = useDelayedLoading(activeTab === null);

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
    if (remainingCandidates === 0) {
      // 未登録のパネルごと消えるので、フォーカスを body へ落とさず、移る先のタブへ先に預ける
      const inPanel = document
        .getElementById("scan-tabpanel-unregistered")
        ?.contains(document.activeElement);
      if (inPanel || isFocusLost()) {
        document.getElementById("scan-tab-newWorks")?.focus({ preventScroll: true });
      }
      setActiveTab("newWorks");
    }
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
          {landingLoading === "visible" ? (
            <CollectionStatus variant="list" kind="loading" />
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** 開いたときは件数のあるタブへ着地する。決まるまでは、どのタブも選ばない。
 *  スキャン完了後は、今のタブが空のときだけ同じ規則で移る。 */
function useActiveTab(
  counts: ScanTabCounts,
  pending: ScanTabPending,
): [ScanTabKey | null, (tab: ScanTabKey) => void] {
  const landing = landingTab(counts, pending);
  const [tab, setTab] = useState<ScanTabKey | null>(landing);
  const refreshed = useAtomValue(scanResultsRefreshedAtom);
  const seenRefreshed = useRef(refreshed);

  useEffect(() => {
    if (tab === null && landing !== null) setTab(landing);
  }, [tab, landing]);

  // 完了を見たとき今のタブが空なら、着地が決まった時点で移る（先頭側のタブの件数が読み込み中で着地が決まらないあいだも移動を落とさない）
  const [moveNeeded, setMoveNeeded] = useState(false);
  const selectTab = useCallback((next: ScanTabKey) => {
    setMoveNeeded(false);
    setTab(next);
  }, []);
  useEffect(() => {
    if (seenRefreshed.current === refreshed) return;
    seenRefreshed.current = refreshed;
    if (tab !== null && counts[tab] === 0) setMoveNeeded(true);
  }, [refreshed, tab, counts]);

  useEffect(() => {
    if (!moveNeeded || landing === null) return;
    setMoveNeeded(false);
    if (tab !== null && counts[tab] === 0) setTab(landing);
  }, [moveNeeded, landing, tab, counts]);

  return [tab, selectTab];
}
