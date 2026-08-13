import { useState } from "react";
import { useAtomValue } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { libraryTotalQueryOptions } from "../../../entities/work/libraryTotalQueryOptions";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { cn } from "../../../shared/lib/cn";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { scanningAtom, scanProgressAtom } from "../../../entities/scan/model/atoms";
import { useScanActions } from "../../../entities/scan/useScanActions";
import { getLastScanResult, getScanCandidates, getScanDiagnostics, SCAN_QUERY_KEYS } from "../api";
import ScanSidebar from "./scanModal/ScanSidebar";
import UnregisteredTab from "./scanModal/UnregisteredTab";
import NeedsAttentionTab from "./scanModal/NeedsAttentionTab";
import NewlyRegisteredTab from "./scanModal/NewlyRegisteredTab";
import UpdatedWorksTab from "./scanModal/UpdatedWorksTab";
import ScanFooter from "./scanModal/ScanFooter";
import { useScanCompletionHint } from "./scanModal/useScanCompletionHint";
import type { ScanTabKey } from "./scanModal/types";

interface ScanModalProps {
  lastScanTime: string | null;
  onClose: () => void;
  /** RJコード未検出の作品一覧を開く（結果にrjCodeMissingCount > 0のときのみ表示） */
  onOpenRjCodeMissing: () => void;
  onOpenFiles: (path: string) => void;
}

const EMPTY_WORK_IDS: string[] = [];

export default function ScanModal({
  lastScanTime,
  onClose,
  onOpenRjCodeMissing,
  onOpenFiles,
}: ScanModalProps) {
  const scanning = useAtomValue(scanningAtom);
  const progress = useAtomValue(scanProgressAtom);
  const { start, cancel } = useScanActions();
  const [activeTab, setActiveTab] = useState<ScanTabKey>("unregistered");

  // 前回スキャン結果（ディスク永続化なし、TASK-56）。サーバー起動後に一度でも完了していれば
  // GET /api/scan/last から取得でき、リロードをまたいでスキャンモーダルに表示できる。
  const lastScanQuery = useQuery({
    queryKey: SCAN_QUERY_KEYS.last(),
    queryFn: getLastScanResult,
  });
  const lastResult = lastScanQuery.data?.result ?? null;

  const candidatesQuery = useQuery({
    queryKey: SCAN_QUERY_KEYS.candidates(),
    queryFn: getScanCandidates,
    enabled: (lastResult?.candidates.length ?? 0) > 0,
    initialData: lastResult && lastResult.candidates.length > 0 ? lastResult.candidates : undefined,
  });
  const candidates = candidatesQuery.data ?? lastResult?.candidates ?? [];

  // ID重複はFilesでの解決を随時反映する必要があるため、スキャン時点のスナップショットではなく
  // 常に最新の診断を購読する（TASK-322）。FilePreview の解決操作が同じキーを無効化する。
  const diagnosticsQuery = useQuery({
    queryKey: SCAN_QUERY_KEYS.diagnostics(),
    queryFn: getScanDiagnostics,
  });
  const identityConflicts = diagnosticsQuery.data?.diagnostics ?? [];
  const invalidMetaFiles = lastResult?.invalidMetaFiles ?? [];
  const rjCodeMissingCount = lastResult?.rjCodeMissingCount ?? 0;
  const dataIntegrityWarning = lastResult?.dataIntegrityWarning;

  const insertedWorkIds = lastResult?.insertedWorkIds ?? EMPTY_WORK_IDS;
  const updatedWorkIds = lastResult?.updatedWorkIds ?? EMPTY_WORK_IDS;

  // ライブラリ総件数（サイドバーの「ライブラリ N 件」と同じ既存クエリキーを共有する）。
  const libraryTotalQuery = useQuery(libraryTotalQueryOptions);
  const libraryTotal = libraryTotalQuery.data?.total ?? null;

  const { showCompletedHint } = useScanCompletionHint(scanning);

  const needsAttentionCount =
    identityConflicts.reduce((total, conflict) => total + conflict.paths.length, 0) +
    invalidMetaFiles.length +
    (rjCodeMissingCount > 0 ? 1 : 0) +
    (dataIntegrityWarning ? 1 : 0);

  const counts: Record<ScanTabKey, number> = {
    unregistered: candidates.length,
    needsAttention: needsAttentionCount,
    newlyRegistered: insertedWorkIds.length,
    updated: updatedWorkIds.length,
  };

  // スキャン実行中でも閉じられる。スキャン自体はバックグラウンドで継続する（TASK-56）。
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose });

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックで閉じる。EscapeはonCancel（useDialogModal）で処理する。
    <dialog
      ref={dialogRef}
      aria-labelledby="scan-modal-title"
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      className="m-auto w-[min(740px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex max-h-[min(80vh,calc(100vh-32px))] min-h-0 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-2 border-b border-line-soft px-[18px] py-[14px]">
          <I.refresh size={14} className={cn("text-ink-3", scanning && "animate-spin")} />
          <h2 id="scan-modal-title" className="flex-1 font-sans text-[14px] font-semibold">
            スキャン
          </h2>
          <IconButton icon={I.x} label="閉じる" size="sm" onClick={onClose} />
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ScanSidebar
            active={activeTab}
            onSelect={setActiveTab}
            counts={counts}
            skippedCount={lastResult?.skipped ?? null}
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
            {activeTab === "unregistered" && <UnregisteredTab candidates={candidates} />}
            {activeTab === "needsAttention" && (
              <NeedsAttentionTab
                identityConflicts={identityConflicts}
                invalidMetaFiles={invalidMetaFiles}
                rjCodeMissingCount={rjCodeMissingCount}
                dataIntegrityWarning={dataIntegrityWarning}
                onOpenFiles={onOpenFiles}
                onOpenRjCodeMissing={onOpenRjCodeMissing}
              />
            )}
            {activeTab === "newlyRegistered" && <NewlyRegisteredTab workIds={insertedWorkIds} />}
            {activeTab === "updated" && <UpdatedWorksTab workIds={updatedWorkIds} />}
          </div>
        </div>

        <ScanFooter
          scanning={scanning}
          hasResult={lastResult !== null}
          onCancel={() => void cancel()}
          onFullScan={() => void start({ full: true })}
          onStart={() => void start()}
        />
      </div>
    </dialog>
  );
}
