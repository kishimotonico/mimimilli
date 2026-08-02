import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { DlsiteApplyBody, DlsiteWorkInfo, WorkRegisterPreview } from "@mimimilli/shared";
import { ApiRequestError } from "../../../shared/api/http";
import Button from "../../../shared/ui/Button";
import IconButton from "../../../shared/ui/IconButton";
import { I } from "../../../shared/ui/Icon";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { buildDlsiteApplyBody, dlsiteInfoTags } from "../../library/model/dlsitePreview";
import { createWork, fetchDlsiteInfoByCode } from "../api";

const inputClass =
  "h-8 min-w-0 w-full rounded-[6px] border border-line bg-paper-0 px-2.5 font-sans text-[12px] text-ink-0 placeholder:text-ink-4 focus:border-acc focus:outline-none focus:ring-2 focus:ring-acc-soft disabled:cursor-not-allowed disabled:text-ink-4";

function dlsiteErrorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) return "DLsite情報の取得に失敗しました";
  if (error.code === "not_found") return "作品が見つかりません。コードが違うかもしれません。";
  if (error.code === "parse_error") return "DLsiteのページ構造が変わった可能性があります。";
  return "DLsiteとの通信に失敗しました。時間をおいて再試行してください。";
}

interface RegisterWorkDialogProps {
  folderPath: string;
  preview: WorkRegisterPreview;
  onRegistered: () => void;
  onClose: () => void;
}

export default function RegisterWorkDialog({
  folderPath,
  preview,
  onRegistered,
  onClose,
}: RegisterWorkDialogProps) {
  const [title, setTitle] = useState(preview.suggestedTitle);
  const [rjCode, setRjCode] = useState(preview.detectedRjCode ?? "");
  const [dlsiteInfo, setDlsiteInfo] = useState<DlsiteWorkInfo | null>(null);
  const [applyTitle, setApplyTitle] = useState(true);
  const [applyCover, setApplyCover] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(preview.suggestedTitle);
    setRjCode(preview.detectedRjCode ?? "");
    setDlsiteInfo(null);
    setSelectedTags([]);
    setError(null);
  }, [folderPath, preview]);

  const close = () => {
    if (!busy) onClose();
  };
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose: close });

  const allInfoTags = useMemo(() => (dlsiteInfo ? dlsiteInfoTags(dlsiteInfo) : []), [dlsiteInfo]);

  const fetchDlsite = async () => {
    const code = rjCode.trim();
    if (!code) {
      setError("RJ/VJコードを入力してください");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const info = await fetchDlsiteInfoByCode(code);
      setDlsiteInfo(info);
      setApplyTitle(info.title !== title);
      setApplyCover(Boolean(info.coverUrl));
      setSelectedTags(dlsiteInfoTags(info));
    } catch (cause) {
      setError(dlsiteErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    setBusy(true);
    setError(null);
    try {
      const dlsite: DlsiteApplyBody | undefined = dlsiteInfo
        ? buildDlsiteApplyBody(dlsiteInfo, { applyTitle, applyCover, applyTags: selectedTags })
        : undefined;
      await createWork({
        path: folderPath,
        title: title.trim(),
        mergeDescendantWorks: preview.descendantWorkCount > 0,
        dlsite,
      });
      onRegistered();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "作品の登録に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックはuseDialogModalで判定する。
    <dialog
      ref={dialogRef}
      aria-labelledby="register-work-title"
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event, close, () => !busy)}
      className="m-auto w-[min(520px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex max-h-[calc(100vh-48px)] min-h-0 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center border-b border-line-soft px-[18px] py-[14px]">
          <h2
            id="register-work-title"
            className="min-w-0 flex-1 font-sans text-[14px] font-semibold"
          >
            このフォルダーを作品として登録
          </h2>
          <IconButton icon={I.x} label="閉じる" size="sm" disabled={busy} onClick={close} />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-3 text-[12px]">
          {preview.orphanedMeta && (
            <p className="mb-3 rounded-[6px] border border-line-soft bg-paper-0 px-3 py-2 text-[11px] leading-[1.6] text-ink-1">
              このフォルダーには以前の登録情報が残っています。内容を引き継いで復元します。
            </p>
          )}

          {preview.descendantWorkCount > 0 && (
            <p className="mb-3 rounded-[6px] border border-[color-mix(in_oklch,var(--r-coral)_35%,transparent)] bg-[color-mix(in_oklch,var(--r-coral)_8%,transparent)] px-3 py-2 text-[11px] leading-[1.6] text-ink-1">
              登録済み作品 <b>{preview.descendantWorkCount}</b> 件を解除して統合します。
              子作品の履歴・タグは引き継がれません。
            </p>
          )}

          <label className="mb-3 flex flex-col gap-1">
            <span className="font-sans text-[11px] font-medium text-ink-2">タイトル</span>
            <input
              className={inputClass}
              value={title}
              disabled={busy}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <div className="mb-3 flex flex-col gap-2 rounded-[8px] border border-line-soft p-3">
            <span className="font-sans text-[11px] font-medium text-ink-2">DLsite連携（任意）</span>
            <div className="flex gap-2">
              <input
                className={`${inputClass} font-mono text-[11px]`}
                value={rjCode}
                disabled={busy}
                placeholder="RJ123456"
                onChange={(event) => setRjCode(event.target.value)}
              />
              <Button variant="ghost" disabled={busy} onClick={fetchDlsite}>
                取得
              </Button>
            </div>
            {dlsiteInfo && (
              <div className="mt-1 flex flex-col gap-1.5 text-[11px]">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={applyTitle}
                    onChange={(event) => setApplyTitle(event.target.checked)}
                  />
                  タイトルを適用: {dlsiteInfo.title}
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={applyCover}
                    disabled={!dlsiteInfo.coverUrl}
                    onChange={(event) => setApplyCover(event.target.checked)}
                  />
                  カバー画像を適用
                </label>
                {allInfoTags.length > 0 && (
                  <fieldset className="m-0 border-none p-0">
                    <legend className="mb-1 font-sans font-medium">タグ</legend>
                    {allInfoTags.map((tag) => (
                      <label key={tag} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={(event) =>
                            setSelectedTags((prev) =>
                              event.target.checked
                                ? [...prev, tag]
                                : prev.filter((entry) => entry !== tag),
                            )
                          }
                        />
                        {tag}
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>
            )}
          </div>

          {error && <p className="m-0 text-[11px] text-[var(--r-coral)]">{error}</p>}
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-line-soft px-[18px] py-3">
          <Button variant="ghost" disabled={busy} onClick={close}>
            キャンセル
          </Button>
          <Button variant="primary" disabled={busy || title.trim().length === 0} onClick={register}>
            登録
          </Button>
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}
