import { useEffect, useRef, useState, type RefObject } from "react";
import { useAtomValue } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { getDefaultPlaylistTrackCount, type ScanResult, type Work } from "@mimimilli/shared";
import { getWork, patchWork } from "../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { searchWorks } from "../../library/api";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import Presence from "../../../shared/ui/Presence";
import { cn } from "../../../shared/lib/cn";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { scanPhaseLabel, type ScanProgress } from "../model";
import { scanningAtom, scanProgressAtom } from "../model/atoms";
import { useScanActions } from "../model/useScanActions";
import { getLastScanResult, SCAN_QUERY_KEYS } from "../api";

interface ScanModalProps {
  lastScanTime: string | null;
  onClose: () => void;
  /** RJコード未検出の作品一覧を開く（結果にrjCodeMissingCount > 0のときのみ表示） */
  onOpenRjCodeMissing: () => void;
}

type StatKey = keyof Pick<ScanResult, "registered" | "newlyGenerated" | "errors" | "missing">;
const STAT_KEYS: StatKey[] = ["registered", "newlyGenerated", "errors", "missing"];

/** 完了サインの表示時間。派手にしないため短めに留める。 */
const COMPLETION_HINT_MS = 2400;
/** 変化したバッジの強調が消えるまでの時間（バッジ側のtransition-colorsで滑らかに戻す）。 */
const BADGE_HIGHLIGHT_MS = 1000;

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ja-JP") : "未実行";
}

export default function ScanModal({ lastScanTime, onClose, onOpenRjCodeMissing }: ScanModalProps) {
  const scanning = useAtomValue(scanningAtom);
  const progress = useAtomValue(scanProgressAtom);
  const { start, cancel } = useScanActions();

  // 前回スキャン結果（ディスク永続化なし、TASK-56）。サーバー起動後に一度でも完了していれば
  // GET /api/scan/last から取得でき、リロードをまたいでスキャンモーダルに表示できる。
  // App から降ろした購読（TASK-124）: 唯一の消費者であるここで直接持つ。
  const lastScanQuery = useQuery({
    queryKey: SCAN_QUERY_KEYS.last(),
    queryFn: getLastScanResult,
  });
  const lastResult = lastScanQuery.data?.result ?? null;

  // ライブラリ総件数（サイドバーの「ライブラリ N 件」と同じ既存クエリキーを共有する）。
  // スキャンモーダルで統計バッジが全て0でも蔵書自体は0件ではないことを示すために使う。
  // App から降ろした購読（TASK-124）。
  const libraryTotalQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.total(),
    queryFn: () => searchWorks({ limit: 1 }).then((page) => page.total),
  });
  const libraryTotal = libraryTotalQuery.data ?? null;
  const [newWorks, setNewWorks] = useState<Work[]>([]);
  const [newWorksError, setNewWorksError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // 実行中→完了の遷移を自分で見ていたときだけ、控えめな完了サインを一時的に出す
  // （レイアウトは動かさず、ステータス行のテキストと変化した統計バッジの色だけを使う）。
  const [justCompleted, setJustCompleted] = useState(false);
  const [changedKeys, setChangedKeys] = useState<ReadonlySet<StatKey>>(new Set());
  const wasScanningRef = useRef(scanning);
  const resultBeforeRunRef = useRef(lastResult);
  useEffect(() => {
    const wasScanning = wasScanningRef.current;
    wasScanningRef.current = scanning;
    if (!wasScanning && scanning) {
      resultBeforeRunRef.current = lastResult;
      return;
    }
    if (!(wasScanning && !scanning)) return;
    const before = resultBeforeRunRef.current;
    const changed = new Set<StatKey>(
      STAT_KEYS.filter((key) => (before?.[key] ?? 0) !== (lastResult?.[key] ?? 0)),
    );
    setChangedKeys(changed);
    setJustCompleted(true);
    const hintTimer = setTimeout(() => setJustCompleted(false), COMPLETION_HINT_MS);
    const badgeTimer = setTimeout(() => setChangedKeys(new Set()), BADGE_HIGHLIGHT_MS);
    return () => {
      clearTimeout(hintTimer);
      clearTimeout(badgeTimer);
    };
  }, [scanning, lastResult]);

  const wasScanning = wasScanningRef.current;
  const justStoppedScanning = wasScanning && !scanning;

  // Escapeはタイトル編集中ならそちらだけをキャンセルし、モーダル自体は閉じない。
  // 実行中でもEscape/背景クリックで閉じられるが、スキャン自体はバックグラウンドで継続する（TASK-56）。
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({
    onClose: () => {
      if (editingId) {
        setEditingId(null);
        setEditError(null);
        return;
      }
      onClose();
    },
  });

  const newWorkIds = lastResult?.newWorkIds ?? [];
  const newWorkIdsKey = newWorkIds.join(",");
  useEffect(() => {
    setNewWorks([]);
    setNewWorksError(null);
    if (newWorkIds.length === 0) return;

    let cancelled = false;
    Promise.all(newWorkIds.map((id) => getWork(id)))
      .then((works) => {
        if (!cancelled) setNewWorks(works);
      })
      .catch(() => {
        if (!cancelled) {
          setNewWorks([]);
          setNewWorksError("新規作品の読み込みに失敗しました");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- newWorkIds は配列参照が毎回変わるため内容で比較する
  }, [newWorkIdsKey]);

  useEffect(() => {
    if (!editingId) return;
    titleInputRef.current?.focus({ preventScroll: true });
  }, [editingId]);

  const handleStartEdit = (work: Work) => {
    setEditingId(work.id);
    setEditTitle(work.title);
    setEditError(null);
  };

  const handleSaveTitle = async (workId: string) => {
    if (editSaving) return;
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      setEditError(null);
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await patchWork(workId, { title: trimmed });
      setNewWorks((prev) => prev.map((w) => (w.id === workId ? { ...w, title: trimmed } : w)));
      setEditingId(null);
    } catch {
      setEditError("タイトルの保存に失敗しました");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックで閉じる。EscapeはonCancel（useDialogModal）で処理する。
    <dialog
      ref={dialogRef}
      aria-labelledby="scan-modal-title"
      onCancel={handleCancel}
      onClick={(e) => handleBackdropClick(e, onClose)}
      className="m-auto w-[min(460px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex max-h-[min(80vh,calc(100vh-32px))] min-h-0 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-2 border-b border-line-soft px-[18px] py-[14px]">
          <I.refresh size={14} className={cn("text-ink-3", scanning && "animate-spin")} />
          <h2 id="scan-modal-title" className="flex-1 font-sans text-[14px] font-semibold">
            スキャン
          </h2>
          <IconButton icon={I.x} label="閉じる" size="sm" onClick={onClose} />
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[18px] py-4">
          <StatusRow
            scanning={scanning}
            progress={progress}
            lastScanTime={lastScanTime}
            showCompletedHint={justCompleted || justStoppedScanning}
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

          <Presence
            show={!!lastResult && lastResult.rjCodeMissingCount > 0}
            variant="collapse"
            skipInitial
          >
            <button
              type="button"
              onClick={onOpenRjCodeMissing}
              className="flex w-full items-center gap-2 overflow-hidden rounded-[6px] border border-[color-mix(in_oklch,var(--r-mustard)_35%,transparent)] bg-[color-mix(in_oklch,var(--r-mustard)_10%,transparent)] px-3 py-2 text-left hover:bg-[color-mix(in_oklch,var(--r-mustard)_16%,transparent)]"
            >
              <I.err size={13} className="shrink-0 text-[var(--r-mustard)]" />
              <span className="flex-1 font-jp text-[12px] text-ink-0">
                RJコード未検出の作品が{lastResult?.rjCodeMissingCount ?? 0}件あります
              </span>
              <I.chev size={12} className="shrink-0 text-ink-3" />
            </button>
          </Presence>

          <Presence show={newWorks.length > 0 || !!newWorksError} variant="collapse" skipInitial>
            <p className="font-sans text-[10.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
              新規検出した作品
            </p>
            {newWorksError ? (
              <p className="font-jp text-[12px] text-[var(--r-coral)]">{newWorksError}</p>
            ) : (
              <ul className="flex max-h-[220px] list-none flex-col gap-1 overflow-y-auto p-0">
                {newWorks.map((work) => (
                  <li key={work.id}>
                    <NewWorkRow
                      work={work}
                      editing={editingId === work.id}
                      editTitle={editTitle}
                      editSaving={editingId === work.id && editSaving}
                      editError={editingId === work.id ? editError : null}
                      titleInputRef={titleInputRef}
                      onStartEdit={() => handleStartEdit(work)}
                      onChangeEditTitle={setEditTitle}
                      onSaveTitle={() => handleSaveTitle(work.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Presence>
        </div>

        <footer className="relative flex shrink-0 items-center justify-between gap-3 border-t border-line-soft px-[18px] py-3">
          <Presence
            show={scanning}
            variant="fade"
            skipInitial
            className="font-jp text-[11px] text-ink-3"
          >
            閉じてもバックグラウンドで続行します
          </Presence>
          <div className="relative flex shrink-0 items-center gap-2">
            <Presence
              show={scanning}
              as="button"
              type="button"
              variant="fade"
              skipInitial
              onClick={() => void cancel().catch(() => {})}
              className="inline-flex h-9 min-w-[128px] items-center justify-center gap-1.5 rounded-[6px] border border-[color-mix(in_oklch,var(--r-coral)_45%,transparent)] bg-[color-mix(in_oklch,var(--r-coral)_10%,transparent)] px-4 font-sans text-[12.5px] font-medium text-ink-0 transition-colors hover:bg-[color-mix(in_oklch,var(--r-coral)_16%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
            >
              <I.x size={12} />
              スキャンを中止
            </Presence>
            <Presence
              show={!scanning}
              as="button"
              type="button"
              variant="fade"
              skipInitial
              onClick={() => void start({ full: true }).catch(() => {})}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] border border-line-soft bg-paper-0 px-3 font-sans text-[12px] font-medium text-ink-1 transition-colors hover:bg-paper-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
            >
              <I.refresh size={12} />
              フルスキャン
            </Presence>
            <Presence
              show={!scanning}
              as="button"
              type="button"
              variant="fade"
              skipInitial
              onClick={() => void start().catch(() => {})}
              className="inline-flex h-9 min-w-[128px] items-center justify-center gap-1.5 rounded-[6px] bg-ink-0 px-4 font-sans text-[12.5px] font-semibold text-paper-1 transition-colors hover:bg-acc focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
            >
              <I.refresh size={12} />
              スキャン開始
            </Presence>
          </div>
        </footer>
      </div>
    </dialog>
  );
}

/** 「最終スキャン: 日時」⇄「実行中のフェーズと進捗」⇄「完了しました」を同じ行の位置で入れ替える。
 *  完了サインは justCompleted の間だけ一時的に挟まり、その後は最終スキャン日時に戻る。 */
function StatusRow({
  scanning,
  progress,
  lastScanTime,
  showCompletedHint,
}: {
  scanning: boolean;
  progress: ScanProgress | null;
  lastScanTime: string | null;
  showCompletedHint: boolean;
}) {
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : null;

  return (
    <div className="relative flex min-h-[20px] flex-col gap-1.5">
      <Presence show={scanning} variant="fade" skipInitial className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-sans text-[13px] font-medium text-ink-0">
            {progress ? scanPhaseLabel(progress.phase) : "準備中"}
          </span>
          <span className="font-mono text-[11px] text-ink-2 tabular-nums">
            {progress && progress.total > 0 ? `${progress.processed}/${progress.total}` : "…"}
          </span>
        </div>
        <div className="h-[3px] overflow-hidden rounded-full bg-paper-2">
          <div
            className={cn(
              "h-full rounded-full bg-acc transition-[width] duration-300 ease-out",
              pct === null && "w-1/3 animate-pulse",
            )}
            style={pct !== null ? { width: `${pct}%` } : undefined}
          />
        </div>
      </Presence>
      <Presence
        show={!scanning && showCompletedHint}
        variant="fade"
        skipInitial
        className="flex items-center gap-1.5"
      >
        <I.check size={12} className="text-[var(--r-leaf)]" />
        <span className="font-sans text-[13px] font-medium text-ink-0">完了しました</span>
      </Presence>
      <Presence show={!scanning && !showCompletedHint} variant="fade" skipInitial>
        <span className="font-mono text-[11px] text-ink-2">
          最終スキャン: {formatDate(lastScanTime)}
        </span>
      </Presence>
    </div>
  );
}

const STAT_TILES: Array<{
  key: StatKey;
  label: string;
  tone: (value: number) => string;
}> = [
  { key: "registered", label: "登録済み", tone: () => "text-ink-0" },
  { key: "newlyGenerated", label: "新規検出", tone: () => "text-ink-0" },
  { key: "errors", label: "エラー", tone: (v) => (v > 0 ? "text-[var(--r-coral)]" : "text-ink-3") },
  {
    key: "missing",
    label: "行方不明",
    tone: (v) => (v > 0 ? "text-[var(--r-mustard)]" : "text-ink-3"),
  },
];

/** 常に4枠を表示し、値だけが更新される（実行中も直前の値のまま）。
 *  changedKeys に含まれる枠は、直前のスキャンで値が変わったことを示す短い強調を出す。 */
function StatsGrid({
  result,
  changedKeys,
}: {
  result: ScanResult | null;
  changedKeys: ReadonlySet<StatKey>;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {STAT_TILES.map(({ key, label, tone }) => {
        const value = result?.[key] ?? null;
        const highlighted = changedKeys.has(key);
        return (
          <div
            key={key}
            className={cn(
              "flex flex-col gap-0.5 rounded-[6px] border px-2.5 py-2 transition-colors duration-700",
              highlighted
                ? "border-[color-mix(in_oklch,var(--acc)_45%,transparent)] bg-[color-mix(in_oklch,var(--acc)_12%,transparent)]"
                : "border-line-soft bg-paper-0",
            )}
          >
            <span
              className={cn(
                "font-mono text-[16px] leading-none font-semibold tabular-nums",
                value === null ? "text-ink-4" : tone(value),
              )}
            >
              {value ?? "—"}
            </span>
            <span className="font-jp text-[10px] text-ink-3">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function NewWorkRow({
  work,
  editing,
  editTitle,
  editSaving,
  editError,
  titleInputRef,
  onStartEdit,
  onChangeEditTitle,
  onSaveTitle,
}: {
  work: Work;
  editing: boolean;
  editTitle: string;
  editSaving: boolean;
  editError: string | null;
  titleInputRef: RefObject<HTMLInputElement | null>;
  onStartEdit: () => void;
  onChangeEditTitle: (title: string) => void;
  onSaveTitle: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[6px] border border-line-soft bg-paper-0 px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-pill bg-[color-mix(in_oklch,var(--r-leaf)_16%,transparent)] px-1.5 py-0.5 font-sans text-[9.5px] font-semibold text-[var(--r-leaf)]">
          NEW
        </span>
        {editing ? (
          <input
            ref={titleInputRef}
            value={editTitle}
            disabled={editSaving}
            onChange={(e) => onChangeEditTitle(e.target.value)}
            onBlur={onSaveTitle}
            onKeyDown={(e) => {
              // Escapeのキャンセルは dialog の onCancel（useDialogModal）に一元化する
              if (e.key === "Enter") onSaveTitle();
            }}
            className={cn(
              "min-w-0 flex-1 rounded-[4px] border bg-paper-2 px-2 py-0.5 font-jp text-[12.5px] text-ink-0 outline-none disabled:opacity-60",
              editError ? "border-[var(--r-coral)]" : "border-acc",
            )}
          />
        ) : (
          <button
            type="button"
            onClick={onStartEdit}
            title="クリックしてタイトルを編集"
            className="min-w-0 flex-1 truncate text-left font-jp text-[12.5px] text-ink-0"
          >
            {work.title}
          </button>
        )}
        <span className="shrink-0 font-mono text-[10.5px] text-ink-4">
          {editSaving ? "保存中…" : `${getDefaultPlaylistTrackCount(work)} tracks`}
        </span>
      </div>
      {editError && (
        <span role="alert" className="mll-selectable font-jp text-[10.5px] text-[var(--r-coral)]">
          {editError}
        </span>
      )}
    </div>
  );
}
