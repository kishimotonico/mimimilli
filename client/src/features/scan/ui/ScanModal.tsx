import { useEffect, useRef, useState } from "react";
import { getDefaultPlaylistTrackCount, type ScanResult, type Work } from "@mimimilli/shared";
import { getWork, patchWork } from "../../../entities/work/api";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { I } from "../../../shared/ui/Icon";
import { SCAN_PHASE_ORDER, scanPhaseLabel, type ScanProgress } from "../model";

interface ScanModalProps {
  scanning: boolean;
  progress: ScanProgress | null;
  /** サーバー起動後に一度でも完了していれば入る、前回スキャン結果（ディスク永続化はしない） */
  lastResult: ScanResult | null;
  lastScanTime: string | null;
  onStart: () => void;
  onCancel: () => void;
  onClose: () => void;
  /** RJコード未検出の作品一覧を開く（結果にrjCodeMissingCount > 0のときのみ表示） */
  onOpenRjCodeMissing: () => void;
}

const C = {
  bgSurface: "var(--paper-1)",
  bgInput: "var(--paper-2)",
  textPrimary: "var(--ink-0)",
  textSecondary: "var(--ink-2)",
  textDisabled: "var(--ink-4)",
  accent: "var(--acc)",
  accentDim: "var(--acc-soft)",
  error: "var(--r-coral)",
  warning: "var(--r-mustard)",
  success: "var(--r-leaf)",
};

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("ja-JP") : "未実行";
}

export default function ScanModal({
  scanning,
  progress,
  lastResult,
  lastScanTime,
  onStart,
  onCancel,
  onClose,
  onOpenRjCodeMissing,
}: ScanModalProps) {
  const [newWorks, setNewWorks] = useState<Work[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Escapeはタイトル編集中ならそちらだけをキャンセルし、モーダル自体は閉じない。
  // 実行中でもEscape/背景クリックで閉じられるが、スキャン自体はバックグラウンドで継続する（TASK-56）。
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({
    onClose: () => {
      if (editingId) {
        setEditingId(null);
        return;
      }
      onClose();
    },
  });

  const newWorkIds = lastResult?.newWorkIds ?? [];
  useEffect(() => {
    if (newWorkIds.length === 0) {
      setNewWorks([]);
      return;
    }
    Promise.all(newWorkIds.map((id) => getWork(id)))
      .then(setNewWorks)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- newWorkIds は配列参照が毎回変わるため内容で比較する
  }, [newWorkIds.join(",")]);

  useEffect(() => {
    if (!editingId) return;
    titleInputRef.current?.focus({ preventScroll: true });
  }, [editingId]);

  const handleStartEdit = (work: Work) => {
    setEditingId(work.id);
    setEditTitle(work.title);
  };

  const handleSaveTitle = async (workId: string) => {
    if (editTitle.trim()) {
      await patchWork(workId, { title: editTitle.trim() }).catch(() => {});
      setNewWorks((prev) =>
        prev.map((w) => (w.id === workId ? { ...w, title: editTitle.trim() } : w)),
      );
    }
    setEditingId(null);
  };

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックで閉じる。EscapeはonCancel（useDialogModal）で処理する。
    <dialog
      ref={dialogRef}
      aria-label="スキャン"
      onCancel={handleCancel}
      onClick={(e) => handleBackdropClick(e, onClose)}
      className="backdrop:bg-[oklch(0%_0_0_/_0.55)]"
      style={{
        background: C.bgSurface,
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: 22,
        margin: "auto",
        width: 520,
        maxWidth: "min(90vw, calc(100vw - 32px))",
        maxHeight: "min(80vh, calc(100vh - 32px))",
        color: C.textPrimary,
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-jp)",
      }}
    >
      <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, textAlign: "center" }}>
        {scanning ? "スキャン中" : "スキャン"}
      </h2>

      {scanning ? (
        <ScanRunningFace progress={progress} onCancel={onCancel} />
      ) : (
        <ScanSummaryFace
          lastResult={lastResult}
          lastScanTime={lastScanTime}
          newWorks={newWorks}
          editingId={editingId}
          editTitle={editTitle}
          titleInputRef={titleInputRef}
          onStart={onStart}
          onOpenRjCodeMissing={onOpenRjCodeMissing}
          onStartEdit={handleStartEdit}
          onChangeEditTitle={setEditTitle}
          onSaveTitle={handleSaveTitle}
        />
      )}

      <button
        onClick={onClose}
        style={{
          background: scanning ? C.bgInput : C.accent,
          border: "none",
          borderRadius: 6,
          color: scanning ? C.textPrimary : "var(--paper-1)",
          cursor: "pointer",
          padding: "10px 28px",
          fontSize: 14,
          fontWeight: 600,
          alignSelf: "center",
          marginTop: 16,
        }}
      >
        {scanning ? "閉じる（バックグラウンドで継続）" : "閉じる"}
      </button>
    </dialog>
  );
}

function ScanRunningFace({
  progress,
  onCancel,
}: {
  progress: ScanProgress | null;
  onCancel: () => void;
}) {
  const currentIndex = progress ? SCAN_PHASE_ORDER.indexOf(progress.phase) : -1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {SCAN_PHASE_ORDER.map((phase, index) => {
          const isCurrent = index === currentIndex;
          const isDone = currentIndex >= 0 && index < currentIndex;
          return (
            <div
              key={phase}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 6,
                background: isCurrent ? C.accentDim : "transparent",
                color: isDone ? C.textSecondary : isCurrent ? C.textPrimary : C.textDisabled,
                fontSize: 12.5,
              }}
            >
              {isDone ? (
                <I.check size={13} style={{ color: C.success, flexShrink: 0 }} />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    width: 13,
                    height: 13,
                    flexShrink: 0,
                    borderRadius: "50%",
                    border: `1.5px solid ${isCurrent ? C.accent : "var(--line)"}`,
                    background: isCurrent ? C.accent : "transparent",
                  }}
                />
              )}
              <span style={{ flex: 1 }}>{scanPhaseLabel(phase)}</span>
              {isCurrent && progress && progress.total > 0 && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  {progress.processed}/{progress.total}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onCancel}
        style={{
          alignSelf: "center",
          padding: "8px 16px",
          borderRadius: 6,
          border: `1px solid ${C.error}`,
          background: "color-mix(in oklch, var(--r-coral) 12%, transparent)",
          color: C.textPrimary,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        スキャンを中止
      </button>
    </div>
  );
}

function ScanSummaryFace({
  lastResult,
  lastScanTime,
  newWorks,
  editingId,
  editTitle,
  titleInputRef,
  onStart,
  onOpenRjCodeMissing,
  onStartEdit,
  onChangeEditTitle,
  onSaveTitle,
}: {
  lastResult: ScanResult | null;
  lastScanTime: string | null;
  newWorks: Work[];
  editingId: string | null;
  editTitle: string;
  titleInputRef: React.RefObject<HTMLInputElement | null>;
  onStart: () => void;
  onOpenRjCodeMissing: () => void;
  onStartEdit: (work: Work) => void;
  onChangeEditTitle: (title: string) => void;
  onSaveTitle: (workId: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          textAlign: "center",
          fontSize: 11,
          color: C.textSecondary,
          marginBottom: 12,
        }}
      >
        最終スキャン: {formatDate(lastScanTime)}
      </div>

      {lastResult ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
            justifyContent: "center",
          }}
        >
          <StatBadge label="登録済み" value={lastResult.registered} color={C.accent} />
          <StatBadge label="新規検出" value={lastResult.newlyGenerated} color={C.success} />
          {lastResult.errors > 0 && (
            <StatBadge label="エラー" value={lastResult.errors} color={C.error} />
          )}
          {lastResult.missing > 0 && (
            <StatBadge label="行方不明" value={lastResult.missing} color={C.warning} />
          )}
          {lastResult.rjCodeMissingCount > 0 && (
            <StatBadge label="RJ未検出" value={lastResult.rjCodeMissingCount} color={C.warning} />
          )}
        </div>
      ) : (
        <p
          style={{
            textAlign: "center",
            fontSize: 12.5,
            color: C.textDisabled,
            marginBottom: 16,
          }}
        >
          まだスキャンを実行していません
        </p>
      )}

      {lastResult && lastResult.rjCodeMissingCount > 0 && (
        <button
          type="button"
          onClick={onOpenRjCodeMissing}
          style={{
            alignSelf: "center",
            marginBottom: 16,
            padding: "8px 16px",
            borderRadius: 6,
            border: `1px solid ${C.warning}`,
            background: "color-mix(in oklch, var(--r-mustard) 12%, transparent)",
            color: C.textPrimary,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          RJコード未検出の作品を確認する（{lastResult.rjCodeMissingCount}件）
        </button>
      )}

      {newWorks.length > 0 && (
        <>
          <div style={{ color: C.textSecondary, fontSize: 12, marginBottom: 8 }}>
            新規検出された作品（タイトルをクリックして編集できます）:
          </div>
          <div style={{ flex: 1, overflowY: "auto", marginBottom: 16, maxHeight: 260 }}>
            {newWorks.map((work) => (
              <div
                key={work.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 4,
                  background: C.accentDim,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: C.success, fontSize: 11, flexShrink: 0 }}>NEW</span>
                {editingId === work.id ? (
                  <input
                    ref={titleInputRef}
                    value={editTitle}
                    onChange={(e) => onChangeEditTitle(e.target.value)}
                    onBlur={() => onSaveTitle(work.id)}
                    onKeyDown={(e) => {
                      // Escapeのキャンセルは dialog の onCancel（useDialogModal）に一元化する
                      if (e.key === "Enter") onSaveTitle(work.id);
                    }}
                    style={{
                      flex: 1,
                      background: C.bgInput,
                      border: `1px solid ${C.accent}`,
                      borderRadius: 4,
                      padding: "3px 8px",
                      fontSize: 13,
                      color: C.textPrimary,
                      outline: "none",
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onStartEdit(work)}
                    style={{
                      flex: 1,
                      fontSize: 13,
                      cursor: "pointer",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      background: "none",
                      border: "none",
                      color: "inherit",
                      padding: 0,
                      textAlign: "left",
                    }}
                    title="クリックしてタイトルを編集"
                  >
                    {work.title}
                  </button>
                )}
                <span style={{ color: C.textDisabled, fontSize: 11, flexShrink: 0 }}>
                  {getDefaultPlaylistTrackCount(work)} tracks
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onStart}
        style={{
          alignSelf: "center",
          background: C.accent,
          border: "none",
          borderRadius: 6,
          color: "var(--paper-1)",
          cursor: "pointer",
          padding: "10px 28px",
          fontSize: 14,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <I.refresh size={13} />
        スキャン開始
      </button>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "6px 14px",
        borderRadius: 6,
        background: `color-mix(in oklch, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in oklch, ${color} 28%, transparent)`,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textSecondary }}>{label}</div>
    </div>
  );
}
