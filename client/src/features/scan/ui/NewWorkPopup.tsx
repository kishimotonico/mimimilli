import React, { useState, useEffect, useRef } from "react";
import type { ScanResult, WorkSummary } from "@mimimilli/shared";
import { getAllWorks, patchWork } from "../../../entities/work/api";
import { useDialogModal } from "../../../shared/ui/useDialogModal";

interface NewWorkPopupProps {
  scanResult: ScanResult;
  onClose: () => void;
  /** RJコード未検出の作品一覧を開く（scanResult.rjCodeMissingCount > 0 のときのみ表示） */
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

const NewWorkPopup: React.FC<NewWorkPopupProps> = ({
  scanResult,
  onClose,
  onOpenRjCodeMissing,
}) => {
  const [newWorks, setNewWorks] = useState<WorkSummary[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Escapeはタイトル編集中ならそちらだけをキャンセルし、ポップアップ自体は閉じない
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({
    onClose: () => {
      if (editingId) {
        setEditingId(null);
        return;
      }
      onClose();
    },
  });

  useEffect(() => {
    if (scanResult.newWorkIds.length > 0) {
      getAllWorks()
        .then((all) => {
          const found = all.filter((w) => scanResult.newWorkIds.includes(w.id));
          setNewWorks(found);
        })
        .catch(() => {});
    }
  }, [scanResult.newWorkIds]);

  useEffect(() => {
    if (!editingId) return;
    titleInputRef.current?.focus({ preventScroll: true });
  }, [editingId]);

  const handleStartEdit = (work: WorkSummary) => {
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
      aria-label="スキャン完了"
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
      }}
    >
      {/* Header */}
      <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, textAlign: "center" }}>
        スキャン完了
      </h2>

      {/* Summary stats */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          justifyContent: "center",
        }}
      >
        <StatBadge label="登録済み" value={scanResult.registered} color={C.accent} />
        <StatBadge label="新規検出" value={scanResult.newlyGenerated} color={C.success} />
        {scanResult.errors > 0 && (
          <StatBadge label="エラー" value={scanResult.errors} color={C.error} />
        )}
        {scanResult.missing > 0 && (
          <StatBadge label="行方不明" value={scanResult.missing} color={C.warning} />
        )}
        {scanResult.rjCodeMissingCount > 0 && (
          <StatBadge label="RJ未検出" value={scanResult.rjCodeMissingCount} color={C.warning} />
        )}
      </div>

      {scanResult.rjCodeMissingCount > 0 && (
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
          RJコード未検出の作品を確認する（{scanResult.rjCodeMissingCount}件）
        </button>
      )}

      {/* New works list */}
      {newWorks.length > 0 && (
        <>
          <div
            style={{
              color: C.textSecondary,
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            新規検出された作品（タイトルをクリックして編集できます）:
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              marginBottom: 16,
              maxHeight: 300,
            }}
          >
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
                <span
                  style={{
                    color: C.success,
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  NEW
                </span>
                {editingId === work.id ? (
                  <input
                    ref={titleInputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleSaveTitle(work.id)}
                    onKeyDown={(e) => {
                      // Escapeのキャンセルは dialog の onCancel（useDialogModal）に一元化する
                      if (e.key === "Enter") handleSaveTitle(work.id);
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
                    onClick={() => handleStartEdit(work)}
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
                <span
                  style={{
                    color: C.textDisabled,
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  {work.trackCount} tracks
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          background: C.accent,
          border: "none",
          borderRadius: 6,
          color: "var(--paper-1)",
          cursor: "pointer",
          padding: "10px 28px",
          fontSize: 14,
          fontWeight: 600,
          alignSelf: "center",
        }}
      >
        OK
      </button>
    </dialog>
  );
};

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

export default NewWorkPopup;
