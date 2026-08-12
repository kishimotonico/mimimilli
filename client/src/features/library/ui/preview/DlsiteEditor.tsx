import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { DlsitePreview, Work } from "@mimimilli/shared";
import { applyDlsiteInfo, fetchDlsiteInfo, updateDlsiteState } from "../../../../entities/work/api";
import { dlsiteFetchErrorMessage } from "../../../../entities/work/dlsiteFetchError";
import Button from "../../../../shared/ui/Button";
import IconButton from "../../../../shared/ui/IconButton";
import { I } from "../../../../shared/ui/Icon";
import { useDialogModal } from "../../../../shared/ui/useDialogModal";
import { WORK_QUERY_KEYS } from "../../../../entities/work/queryKeys";
import { useDlsiteInvalidation } from "../../../../entities/dlsite/useDlsiteInvalidation";
import {
  buildDlsiteApplyBody,
  dlsiteInfoTags,
  unappliedDlsiteTags,
} from "../../../../entities/work/dlsitePreview";
import { formatCoverEditLabel } from "../../../../shared/lib/coverLabel";

export const STATUS_LABEL = {
  none: "未連携",
  applied: "連携済み",
  not_found: "見つかりません",
  error: "取得エラー",
  skipped: "連携しない",
} as const;

const inputClass =
  "h-8 min-w-0 rounded-[6px] border border-line bg-paper-0 px-2.5 font-mono text-[11px] text-ink-0 placeholder:text-ink-4 focus:border-acc focus:outline-none focus:ring-2 focus:ring-acc-soft disabled:cursor-not-allowed disabled:text-ink-4";

interface DlsiteApplyDialogProps {
  work: Work;
  preview: DlsitePreview;
  busy: boolean;
  applyTitle: boolean;
  applyCover: boolean;
  applyUrl: boolean;
  selectedTags: string[];
  onApplyTitleChange: (checked: boolean) => void;
  onApplyCoverChange: (checked: boolean) => void;
  onApplyUrlChange: (checked: boolean) => void;
  onSelectedTagsChange: (tags: string[]) => void;
  onApply: () => void;
  onClose: () => void;
}

function DlsiteApplyDialog({
  work,
  preview,
  busy,
  applyTitle,
  applyCover,
  applyUrl,
  selectedTags,
  onApplyTitleChange,
  onApplyCoverChange,
  onApplyUrlChange,
  onSelectedTagsChange,
  onApply,
  onClose,
}: DlsiteApplyDialogProps) {
  const { info } = preview;
  const allInfoTags = useMemo(() => dlsiteInfoTags(info), [info]);
  const close = () => {
    if (!busy) onClose();
  };
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose: close });

  return createPortal(
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックはuseDialogModalで判定する。
    <dialog
      ref={dialogRef}
      aria-labelledby="dlsite-apply-title"
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event)}
      className="m-auto w-[min(680px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex max-h-[calc(100vh-48px)] min-h-0 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center border-b border-line-soft px-[18px] py-[14px]">
          <h2
            id="dlsite-apply-title"
            className="min-w-0 flex-1 font-sans text-[14px] font-semibold"
          >
            DLsite情報の適用
          </h2>
          <IconButton icon={I.x} label="閉じる" size="sm" disabled={busy} onClick={close} />
        </header>
        <div className="mll-selectable min-h-0 flex-1 overflow-y-auto px-[18px] py-3 text-[11px]">
          <label className="grid grid-cols-[18px_60px_minmax(0,1fr)_18px_minmax(0,1fr)] items-center gap-1.5 border-b border-line-soft py-2">
            <input
              type="checkbox"
              checked={applyTitle}
              onChange={(event) => onApplyTitleChange(event.target.checked)}
            />
            <span>タイトル</span>
            <span className="min-w-0 break-words text-ink-2">{work.title}</span>
            <span className="text-ink-3">→</span>
            <span className="min-w-0 break-words">{info.title}</span>
          </label>
          <label className="grid grid-cols-[18px_60px_minmax(0,1fr)_18px_minmax(0,1fr)] items-center gap-1.5 border-b border-line-soft py-2">
            <input
              type="checkbox"
              checked={applyUrl}
              onChange={(event) => onApplyUrlChange(event.target.checked)}
            />
            <span>URL</span>
            <span className="min-w-0 break-all text-ink-2">
              {work.urls.find((entry) => entry.url.includes("dlsite.com"))?.url ?? "未設定"}
            </span>
            <span className="text-ink-3">→</span>
            <span className="min-w-0 break-all">{info.url}</span>
          </label>
          <label className="grid grid-cols-[18px_60px_minmax(0,1fr)_18px_minmax(0,1fr)] items-center gap-1.5 border-b border-line-soft py-2">
            <input
              type="checkbox"
              checked={applyCover}
              disabled={!info.coverUrl}
              onChange={(event) => onApplyCoverChange(event.target.checked)}
            />
            <span>カバー</span>
            <span className="min-w-0 break-words text-ink-2">{formatCoverEditLabel(work)}</span>
            <span className="text-ink-3">→</span>
            <span>{info.coverUrl ? "DLsite画像" : "画像なし"}</span>
          </label>
          <fieldset className="grid gap-1.5 py-2.5">
            <legend className="mb-1 font-sans font-medium">タグ</legend>
            {allInfoTags.map((tag) => {
              const applied = work.tags.includes(tag);
              return (
                <label key={tag} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    disabled={applied}
                    checked={applied || selectedTags.includes(tag)}
                    onChange={(event) =>
                      onSelectedTagsChange(
                        event.target.checked
                          ? [...selectedTags, tag]
                          : selectedTags.filter((item) => item !== tag),
                      )
                    }
                  />
                  <span>{tag}</span>
                  {applied && <small className="text-ink-3">適用済み</small>}
                </label>
              );
            })}
          </fieldset>
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-line-soft px-[18px] py-3">
          <Button variant="quiet" disabled={busy} onClick={close}>
            キャンセル
          </Button>
          <Button variant="primary" disabled={busy} onClick={onApply}>
            選択内容を適用
          </Button>
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}

export function DlsiteEditor({ work }: { work: Work }) {
  const queryClient = useQueryClient();
  const invalidateDlsiteCache = useDlsiteInvalidation();
  const [rjCode, setRjCode] = useState(work.dlsite.rjCode ?? "");
  const [preview, setPreview] = useState<DlsitePreview | null>(null);
  const [applyTitle, setApplyTitle] = useState(false);
  const [applyCover, setApplyCover] = useState(true);
  const [applyUrl, setApplyUrl] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setRjCode(work.dlsite.rjCode ?? ""), [work.dlsite.rjCode]);

  const refresh = async (updated?: Work) => {
    if (updated) queryClient.setQueryData(WORK_QUERY_KEYS.detail(work.id), updated);
    await invalidateDlsiteCache(updated ? undefined : work.id);
  };

  const saveCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateDlsiteState(work.id, { rjCode: rjCode.trim() || null });
      await refresh(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "コードを保存できませんでした");
    } finally {
      setBusy(false);
    }
  };

  const fetchInfo = async () => {
    setBusy(true);
    setError(null);
    try {
      if (rjCode.trim().toUpperCase() !== work.dlsite.rjCode) {
        const updated = await updateDlsiteState(work.id, { rjCode: rjCode.trim() || null });
        queryClient.setQueryData(WORK_QUERY_KEYS.detail(work.id), updated);
      }
      const nextPreview = await fetchDlsiteInfo(work.id);
      setSelectedTags(unappliedDlsiteTags(work, nextPreview.info));
      setApplyTitle(false);
      setApplyCover(!work.cover && Boolean(nextPreview.info.coverUrl));
      setApplyUrl(!work.urls.some((entry) => entry.url.includes("dlsite.com")));
      setPreview(nextPreview);
    } catch (cause) {
      setError(dlsiteFetchErrorMessage(cause));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await applyDlsiteInfo(
        work.id,
        buildDlsiteApplyBody(preview.info, {
          sourceRevision: preview.sourceRevision,
          applyTitle,
          applyCover,
          applyUrl,
          applyTags: selectedTags,
        }),
      );
      setPreview(null);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message.includes("外部で変更")
          ? "作品データが変更されました。取得結果を確認し直してから適用してください。"
          : cause instanceof Error
            ? cause.message
            : "DLsite情報を適用できませんでした",
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleSkipped = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateDlsiteState(work.id, {
        skipped: work.dlsite.status !== "skipped",
      });
      await refresh(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "連携設定を変更できませんでした");
    } finally {
      setBusy(false);
    }
  };

  const statusTone =
    work.dlsite.status === "applied"
      ? "bg-[color-mix(in_oklch,var(--r-leaf)_12%,transparent)] text-[var(--r-leaf)]"
      : work.dlsite.status === "error" || work.dlsite.status === "not_found"
        ? "bg-[color-mix(in_oklch,var(--r-coral)_12%,transparent)] text-[var(--r-coral)]"
        : "bg-paper-3 text-ink-2";

  return (
    <section aria-labelledby="work-edit-dlsite-title" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3
            id="work-edit-dlsite-title"
            className="font-sans text-[11px] font-semibold text-ink-1"
          >
            DLsite連携
          </h3>
          <span
            className={`rounded-pill px-2 py-0.5 font-sans text-[10px] ${statusTone}`}
            title={work.dlsite.error ?? undefined}
          >
            {STATUS_LABEL[work.dlsite.status]}
          </span>
        </div>
        <label className="flex items-center gap-1.5 font-jp text-[10.5px] text-ink-2">
          <input
            type="checkbox"
            checked={work.dlsite.status === "skipped"}
            disabled={busy}
            onChange={() => void toggleSkipped()}
          />
          この作品は連携しない
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="DLsite RJ/VJコード"
          className={`${inputClass} min-w-[150px] flex-1`}
          value={rjCode}
          disabled={busy}
          placeholder="RJ123456 / VJ123456"
          onChange={(event) => setRjCode(event.target.value)}
        />
        <Button disabled={busy} onClick={() => void saveCode()}>
          コードを保存
        </Button>
        <Button
          variant="primary"
          disabled={busy || !rjCode.trim() || work.dlsite.status === "skipped"}
          onClick={() => void fetchInfo()}
        >
          取得結果を確認
        </Button>
      </div>
      {error && (
        <p className="mle-prv__edit-error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <DlsiteApplyDialog
          work={work}
          preview={preview}
          busy={busy}
          applyTitle={applyTitle}
          applyCover={applyCover}
          applyUrl={applyUrl}
          selectedTags={selectedTags}
          onApplyTitleChange={setApplyTitle}
          onApplyCoverChange={setApplyCover}
          onApplyUrlChange={setApplyUrl}
          onSelectedTagsChange={setSelectedTags}
          onApply={() => void apply()}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}
