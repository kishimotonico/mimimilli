import { useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { WORKS_DEFAULT_PAGE_SIZE, type WorkListItem, type WorksPage } from "@mimimilli/shared";
import { patchWork, searchWorks } from "../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { mutationErrorMessage } from "../../../shared/lib/mutationError";
import { libraryTotalQueryOptions } from "../../../entities/work/libraryTotalQueryOptions";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { cn } from "../../../shared/lib/cn";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { scanningAtom, scanProgressAtom } from "../../../entities/scan/model/atoms";
import { useScanActions } from "../../../entities/scan/useScanActions";
import { getLastScanResult, SCAN_QUERY_KEYS } from "../api";
import StatusRow from "./scanModal/StatusRow";
import StatsGrid from "./scanModal/StatsGrid";
import ScanWarnings from "./scanModal/ScanWarnings";
import ScanNewWorks from "./scanModal/ScanNewWorks";
import {
  ScanCancelButton,
  ScanFooterHint,
  ScanFullScanButton,
  ScanStartButton,
} from "./scanModal/ScanFooterControls";
import { useScanCompletionHint } from "./scanModal/useScanCompletionHint";

interface ScanModalProps {
  lastScanTime: string | null;
  onClose: () => void;
  /** RJコード未検出の作品一覧を開く（結果にrjCodeMissingCount > 0のときのみ表示） */
  onOpenRjCodeMissing: () => void;
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

export default function ScanModal({ lastScanTime, onClose, onOpenRjCodeMissing }: ScanModalProps) {
  const scanning = useAtomValue(scanningAtom);
  const progress = useAtomValue(scanProgressAtom);
  const { start, cancel } = useScanActions();
  const queryClient = useQueryClient();

  // 前回スキャン結果（ディスク永続化なし、TASK-56）。サーバー起動後に一度でも完了していれば
  // GET /api/scan/last から取得でき、リロードをまたいでスキャンモーダルに表示できる。
  // App から降ろした購読（TASK-124）: 唯一の消費者であるここで直接持つ。
  const lastScanQuery = useQuery({
    queryKey: SCAN_QUERY_KEYS.last(),
    queryFn: getLastScanResult,
  });
  const lastResult = lastScanQuery.data?.result ?? null;
  const newWorkIds = lastResult?.newWorkIds ?? EMPTY_WORK_IDS;
  // 初回フルスキャン等でnewWorkIdsが数千〜数万件になりうるため、表示・取得は先頭の
  // 1ページ分（WORKS_DEFAULT_PAGE_SIZE）に制限する。全件をidsへ載せるとURLとSQLite
  // 束縛パラメータの上限を超える。省略が発生したかはScanNewWorks側の表示に渡す。
  const visibleWorkIds = useMemo(() => newWorkIds.slice(0, WORKS_DEFAULT_PAGE_SIZE), [newWorkIds]);
  const truncatedTotal = newWorkIds.length > visibleWorkIds.length ? newWorkIds.length : null;

  // 新規作品の表示用データ（title/trackCount）は visibleWorkIds を1回のworks一覧クエリで引く。
  // WORK_QUERY_KEYS.list() 配下に載るため、DLsite一括取得完了時のWORK_QUERY_KEYS.all()
  // 無効化に自動で乗る（追加の無効化配線は不要）。
  const newWorksParams = useMemo(() => ({ ids: visibleWorkIds }), [visibleWorkIds]);
  const newWorksQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.list(newWorksParams),
    queryFn: () => searchWorks(newWorksParams),
    enabled: visibleWorkIds.length > 0,
  });
  const newWorkOrder = useMemo(
    () => new Map(visibleWorkIds.map((id, index) => [id, index])),
    [visibleWorkIds],
  );
  const newWorks: WorkListItem[] = useMemo(
    () =>
      [...(newWorksQuery.data?.items ?? [])].sort(
        (a, b) => (newWorkOrder.get(a.id) ?? 0) - (newWorkOrder.get(b.id) ?? 0),
      ),
    [newWorksQuery.data, newWorkOrder],
  );

  // ライブラリ総件数（サイドバーの「ライブラリ N 件」と同じ既存クエリキーを共有する）。
  // スキャンモーダルで統計バッジが全て0でも蔵書自体は0件ではないことを示すために使う。
  // App から降ろした購読（TASK-124）。queryKey/queryFn は libraryTotalQueryOptions を
  // 共有し、同じキーに違う形のデータを期待する食い違い（TASK-188）を型で防ぐ。
  const libraryTotalQuery = useQuery(libraryTotalQueryOptions);
  const libraryTotal = libraryTotalQuery.data?.total ?? null;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const saveTitleMutation = useMutation({
    mutationFn: ({ workId, title }: { workId: string; title: string }) =>
      patchWork(workId, { title }),
    onSuccess: (updatedWork, { workId }) => {
      queryClient.setQueryData(WORK_QUERY_KEYS.detail(workId), updatedWork);
      queryClient.setQueryData<WorksPage>(WORK_QUERY_KEYS.list(newWorksParams), (prev) =>
        patchTitleInWorksPage(prev, workId, updatedWork.title),
      );
      setEditingId(null);
    },
  });

  const { showCompletedHint, changedKeys } = useScanCompletionHint(scanning, lastResult);

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
    ? mutationErrorMessage(saveTitleMutation.error, "タイトルの保存に失敗しました")
    : null;
  const editSaving = saveTitleMutation.isPending;

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックで閉じる。EscapeはonCancel（useDialogModal）で処理する。
    <dialog
      ref={dialogRef}
      aria-labelledby="scan-modal-title"
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      className="m-auto w-[min(460px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex max-h-[min(80vh,calc(100vh-32px))] min-h-0 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-2 border-b border-line-soft px-[18px] py-[14px]">
          <I.refresh size={14} className={cn("text-ink-3", scanning && "animate-spin")} />
          <h2 id="scan-modal-title" className="flex-1 font-sans text-[14px] font-semibold">
            スキャン
          </h2>
          <IconButton icon={I.x} label="閉じる" size="sm" onClick={dismiss} />
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[18px] py-4">
          <StatusRow
            scanning={scanning}
            progress={progress}
            lastScanTime={lastScanTime}
            showCompletedHint={showCompletedHint}
          />

          <div className="flex items-baseline justify-between gap-2">
            <span className="font-jp text-[11.5px] text-ink-2">ライブラリ全体</span>
            <span className="font-mono text-[13px] font-semibold text-ink-0 tabular-nums">
              {libraryTotal ?? "—"}
              <span className="ml-1 font-jp text-[10px] font-normal text-ink-3">件</span>
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="font-sans text-[9.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
              今回のスキャン
            </p>
            <StatsGrid result={lastResult} changedKeys={changedKeys} />
          </div>

          <AnimatePresence initial={false}>
            {lastResult &&
              (lastResult.rjCodeMissingCount > 0 || !!lastResult.dataIntegrityWarning) && (
                <ScanWarnings
                  key="warnings"
                  lastResult={lastResult}
                  onOpenRjCodeMissing={onOpenRjCodeMissing}
                />
              )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {newWorks.length > 0 && (
              <ScanNewWorks
                key="new-works"
                newWorks={newWorks}
                truncatedTotal={truncatedTotal}
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
          </AnimatePresence>
        </div>

        <footer className="relative flex shrink-0 items-center justify-between gap-3 border-t border-line-soft px-[18px] py-3">
          <AnimatePresence initial={false}>
            {scanning && <ScanFooterHint key="hint" />}
          </AnimatePresence>
          <div className="relative flex shrink-0 items-center gap-2">
            <AnimatePresence initial={false}>
              {scanning && <ScanCancelButton key="cancel" onClick={() => void cancel()} />}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {!scanning && (
                <ScanFullScanButton key="fullscan" onClick={() => void start({ full: true })} />
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {!scanning && <ScanStartButton key="start" onClick={() => void start()} />}
            </AnimatePresence>
          </div>
        </footer>
      </div>
    </dialog>
  );
}
