import { useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WORKS_DEFAULT_PAGE_SIZE, type WorkListItem, type WorksPage } from "@mimimilli/shared";
import { getWork, patchWork, searchWorks } from "../../../entities/work/api";
import { assertWorkSourceRevision } from "../../../entities/work/sourceRevision";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { libraryTotalQueryOptions } from "../../../entities/work/libraryTotalQueryOptions";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { cn } from "../../../shared/lib/cn";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import Toast from "../../../shared/ui/Toast";
import { scanningAtom, scanProgressAtom } from "../../../entities/scan/model/atoms";
import { useScanActions } from "../../../entities/scan/useScanActions";
import { getLastScanResult, getScanCandidates, getScanDiagnostics, SCAN_QUERY_KEYS } from "../api";
import ScanSidebar from "./scanModal/ScanSidebar";
import UnregisteredTab, { type UnregisteredTabRegisteredResult } from "./scanModal/UnregisteredTab";
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

/** 一覧クエリキャッシュ内のitemsから該当作品のタイトルだけを差し替える */
function patchTitleInWorksPage(
  prev: WorksPage | undefined,
  workId: string,
  title: string,
): WorksPage | undefined {
  if (!prev) return prev;
  return {
    ...prev,
    items: prev.items.map((item) => (item.id === workId ? { ...item, title } : item)),
  };
}

export default function ScanModal({
  lastScanTime,
  onClose,
  onOpenRjCodeMissing,
  onOpenFiles,
}: ScanModalProps) {
  const scanning = useAtomValue(scanningAtom);
  const progress = useAtomValue(scanProgressAtom);
  const { start, cancel } = useScanActions();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ScanTabKey>("unregistered");
  const [unregisteredToast, setUnregisteredToast] = useState<string | null>(null);

  const handleUnregisteredRegistered = ({
    addedCount,
    failedCount,
    remainingCount,
  }: UnregisteredTabRegisteredResult) => {
    setUnregisteredToast(
      failedCount > 0
        ? `${addedCount}件をライブラリに追加しました。${failedCount}件は追加できませんでした。`
        : `${addedCount}件をライブラリに追加しました`,
    );
    if (remainingCount === 0) setActiveTab("newlyRegistered");
  };

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
  // insertedWorkIds/updatedWorkIdsが数千〜数万件になりうるため、表示・取得は先頭の1ページ分
  // （WORKS_DEFAULT_PAGE_SIZE）に制限する。全件をidsへ載せるとURLとSQLite束縛パラメータの
  // 上限を超える。省略が発生したかは各タブ側の表示に渡す。
  const visibleInsertedIds = useMemo(
    () => insertedWorkIds.slice(0, WORKS_DEFAULT_PAGE_SIZE),
    [insertedWorkIds],
  );
  const truncatedInsertedTotal =
    insertedWorkIds.length > visibleInsertedIds.length ? insertedWorkIds.length : null;
  const visibleUpdatedIds = useMemo(
    () => updatedWorkIds.slice(0, WORKS_DEFAULT_PAGE_SIZE),
    [updatedWorkIds],
  );
  const truncatedUpdatedTotal =
    updatedWorkIds.length > visibleUpdatedIds.length ? updatedWorkIds.length : null;

  // 新規登録済み作品の表示用データ（title/trackCount）は visibleInsertedIds を1回のworks一覧
  // クエリで引く。WORK_QUERY_KEYS.list() 配下に載るため、DLsite一括取得完了時のWORK_QUERY_KEYS.all()
  // 無効化に自動で乗る（追加の無効化配線は不要）。
  const newWorksParams = useMemo(() => ({ ids: visibleInsertedIds }), [visibleInsertedIds]);
  const newWorksQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.list(newWorksParams),
    queryFn: () => searchWorks(newWorksParams),
    enabled: visibleInsertedIds.length > 0,
  });
  const newWorksError = newWorksQuery.isError
    ? apiErrorMessage(newWorksQuery.error, "新規作品の読み込みに失敗しました")
    : null;
  const newWorkOrder = useMemo(
    () => new Map(visibleInsertedIds.map((id, index) => [id, index])),
    [visibleInsertedIds],
  );
  const newWorks: WorkListItem[] = useMemo(
    () =>
      [...(newWorksQuery.data?.items ?? [])].sort(
        (a, b) => (newWorkOrder.get(a.id) ?? 0) - (newWorkOrder.get(b.id) ?? 0),
      ),
    [newWorksQuery.data, newWorkOrder],
  );

  const updatedWorksParams = useMemo(() => ({ ids: visibleUpdatedIds }), [visibleUpdatedIds]);
  const updatedWorksQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.list(updatedWorksParams),
    queryFn: () => searchWorks(updatedWorksParams),
    enabled: visibleUpdatedIds.length > 0,
  });
  const updatedWorksError = updatedWorksQuery.isError
    ? apiErrorMessage(updatedWorksQuery.error, "更新された作品の読み込みに失敗しました")
    : null;
  const updatedWorkOrder = useMemo(
    () => new Map(visibleUpdatedIds.map((id, index) => [id, index])),
    [visibleUpdatedIds],
  );
  const updatedWorks: WorkListItem[] = useMemo(
    () =>
      [...(updatedWorksQuery.data?.items ?? [])].sort(
        (a, b) => (updatedWorkOrder.get(a.id) ?? 0) - (updatedWorkOrder.get(b.id) ?? 0),
      ),
    [updatedWorksQuery.data, updatedWorkOrder],
  );

  // ライブラリ総件数（サイドバーの「ライブラリ N 件」と同じ既存クエリキーを共有する）。
  const libraryTotalQuery = useQuery(libraryTotalQueryOptions);
  const libraryTotal = libraryTotalQuery.data?.total ?? null;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const saveTitleMutation = useMutation({
    mutationFn: async ({ workId, title }: { workId: string; title: string }) => {
      const work = await getWork(workId);
      return patchWork(workId, {
        title,
        sourceRevision: assertWorkSourceRevision(work.sourceRevision),
      });
    },
    onSuccess: (updatedWork, { workId }) => {
      queryClient.setQueryData(WORK_QUERY_KEYS.detail(workId), updatedWork);
      queryClient.setQueryData<WorksPage>(WORK_QUERY_KEYS.list(newWorksParams), (prev) =>
        patchTitleInWorksPage(prev, workId, updatedWork.title),
      );
      setEditingId(null);
    },
    onError: (_error, { workId }) => {
      void queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.detail(workId) });
    },
  });

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

  // タイトル編集中は編集だけをキャンセルし、モーダル自体は閉じない。
  // 実行中でも閉じられるが、スキャン自体はバックグラウンドで継続する（TASK-56）。
  const dismiss = () => {
    if (editingId) {
      setEditingId(null);
      saveTitleMutation.reset();
      return;
    }
    onClose();
  };
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose: dismiss });

  useEffect(() => {
    if (!editingId) return;
    titleInputRef.current?.focus({ preventScroll: true });
  }, [editingId]);

  const handleStartEdit = (work: WorkListItem) => {
    setEditingId(work.id);
    setEditTitle(work.title);
    saveTitleMutation.reset();
  };

  const handleSaveTitle = (workId: string) => {
    if (saveTitleMutation.isPending) return;
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      saveTitleMutation.reset();
      return;
    }
    saveTitleMutation.mutate({ workId, title: trimmed });
  };

  const editError = saveTitleMutation.error
    ? apiErrorMessage(saveTitleMutation.error, "タイトルの保存に失敗しました")
    : null;
  const editSaving = saveTitleMutation.isPending;

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
          <IconButton icon={I.x} label="閉じる" size="sm" onClick={dismiss} />
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
            {activeTab === "unregistered" && (
              <UnregisteredTab
                candidates={candidates}
                onRegistered={handleUnregisteredRegistered}
              />
            )}
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
            {activeTab === "newlyRegistered" && (
              <NewlyRegisteredTab
                newWorks={newWorks}
                newWorksError={newWorksError}
                truncatedTotal={truncatedInsertedTotal}
                editingId={editingId}
                editTitle={editTitle}
                editSaving={editSaving}
                editError={editError}
                titleInputRef={titleInputRef}
                onStartEdit={handleStartEdit}
                onChangeEditTitle={setEditTitle}
                onSaveTitle={handleSaveTitle}
              />
            )}
            {activeTab === "updated" && (
              <UpdatedWorksTab
                updatedWorks={updatedWorks}
                updatedWorksError={updatedWorksError}
                truncatedTotal={truncatedUpdatedTotal}
              />
            )}
          </div>
        </div>

        <ScanFooter
          scanning={scanning}
          onCancel={() => void cancel()}
          onFullScan={() => void start({ full: true })}
          onStart={() => void start()}
        />
      </div>
      <Toast
        message={unregisteredToast}
        actionLabel="新規登録済みを見る"
        onAction={() => setActiveTab("newlyRegistered")}
        onDismiss={() => setUnregisteredToast(null)}
      />
    </dialog>
  );
}
