import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { normalizeTag } from "@mimimilli/shared";
import type { DlsiteApplyBody, DlsiteWorkInfo, WorkRegisterPreview } from "@mimimilli/shared";
import { ApiRequestError } from "../../../shared/api/http";
import Button from "../../../shared/ui/Button";
import IconButton from "../../../shared/ui/IconButton";
import { I } from "../../../shared/ui/Icon";
import TagCombobox from "../../../shared/ui/TagCombobox";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { getAllTags } from "../../../entities/tag/api";
import { TAG_QUERY_KEYS } from "../../../entities/tag/queryKeys";
import { buildTagsWithAdded, buildTagsWithRemoved } from "../../../entities/work/editableTags";
import Tag from "../../../entities/work/ui/Tag";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";
import { tagPrefixDefinition } from "../../../entities/tag/tagPrefixDefinition";
import { buildDlsiteApplyBody, dlsiteInfoTags } from "../../../entities/work/dlsitePreview";
import { dlsiteFetchErrorMessage } from "../../../entities/work/dlsiteFetchError";
import { mutationErrorMessage } from "../../../shared/lib/mutationError";
import { createWork, fetchDlsiteInfoByCode } from "../api";

const inputClass =
  "h-8 min-w-0 w-full rounded-[6px] border border-line bg-paper-0 px-2.5 font-sans text-[12px] text-ink-0 placeholder:text-ink-4 focus:border-acc focus:outline-none focus:ring-2 focus:ring-acc-soft disabled:cursor-not-allowed disabled:text-ink-4";

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
  const [tags, setTags] = useState<string[]>(preview.tags);
  const [isTagInputOpen, setIsTagInputOpen] = useState(false);
  const [rjCode, setRjCode] = useState(preview.detectedRjCode ?? "");
  const [dlsiteInfo, setDlsiteInfo] = useState<DlsiteWorkInfo | null>(null);
  const [applyCover, setApplyCover] = useState(true);
  const [dlsiteValidationError, setDlsiteValidationError] = useState<string | null>(null);

  const tagsQuery = useQuery({ queryKey: TAG_QUERY_KEYS.all(), queryFn: getAllTags });
  const tagSuggestions = tagsQuery.data ?? [];
  const { tagPrefixes } = useTagPrefixes();

  const dlsiteMutation = useMutation({
    mutationFn: (code: string) => fetchDlsiteInfoByCode(code),
    onSuccess: (info) => {
      setDlsiteInfo(info);
      setTitle(info.title);
      setTags((prev) => Array.from(new Set([...prev, ...dlsiteInfoTags(info)])));
      setApplyCover(Boolean(info.coverUrl));
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const dlsiteAppliedTags = dlsiteInfo
        ? dlsiteInfoTags(dlsiteInfo).filter((tag) => tags.includes(tag))
        : [];
      const dlsite: DlsiteApplyBody | undefined = dlsiteInfo
        ? buildDlsiteApplyBody(dlsiteInfo, {
            applyTitle: false,
            applyCover,
            applyTags: dlsiteAppliedTags,
          })
        : undefined;
      return createWork({
        path: folderPath,
        title: title.trim(),
        tags,
        mergeDescendantWorks: preview.descendantWorkCount > 0,
        dlsite,
      });
    },
    onSuccess: () => {
      onRegistered();
      onClose();
    },
  });

  useEffect(() => {
    setTitle(preview.suggestedTitle);
    setTags(preview.tags);
    setIsTagInputOpen(false);
    setRjCode(preview.detectedRjCode ?? "");
    setDlsiteInfo(null);
    setApplyCover(true);
    setDlsiteValidationError(null);
    dlsiteMutation.reset();
    registerMutation.reset();

    if (preview.detectedRjCode && !preview.orphanedMeta) {
      dlsiteMutation.mutate(preview.detectedRjCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 開いた瞬間の自動取得はフォルダー・プレビュー単位で1回だけ行う
  }, [folderPath, preview]);

  const submitBusy = registerMutation.isPending;
  const dlsiteBusy = dlsiteMutation.isPending;

  const close = () => {
    if (!submitBusy) onClose();
  };
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose: close });

  const definitionOf = (tag: string) => tagPrefixDefinition(tag, tagPrefixes);

  const addTag = (tag: string) => {
    const next = buildTagsWithAdded(tags, tag);
    if (next) setTags(next);
    setIsTagInputOpen(false);
  };
  const removeTag = (tag: string) => setTags(buildTagsWithRemoved(tags, tag));

  const fetchDlsite = () => {
    const trimmed = rjCode.trim();
    if (!trimmed) {
      setDlsiteValidationError("RJ/VJコードを入力してください");
      return;
    }
    setDlsiteValidationError(null);
    dlsiteMutation.mutate(trimmed);
  };

  const dlsiteError =
    dlsiteValidationError ??
    (dlsiteMutation.error
      ? dlsiteMutation.error instanceof ApiRequestError
        ? dlsiteFetchErrorMessage(dlsiteMutation.error)
        : mutationErrorMessage(dlsiteMutation.error, "DLsite情報の取得に失敗しました")
      : null);
  const submitError = registerMutation.error
    ? mutationErrorMessage(registerMutation.error, "作品の登録に失敗しました")
    : null;

  return createPortal(
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックはuseDialogModalで判定する。
    <dialog
      ref={dialogRef}
      aria-labelledby="register-work-title"
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event)}
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
          <IconButton icon={I.x} label="閉じる" size="sm" disabled={submitBusy} onClick={close} />
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

          <div className="mb-3 flex flex-col gap-2 rounded-[8px] border border-line-soft p-3">
            <span className="font-sans text-[11px] font-medium text-ink-2">DLsite連携（任意）</span>
            <div className="flex gap-2">
              <input
                className={`${inputClass} font-mono text-[11px]`}
                value={rjCode}
                disabled={submitBusy || dlsiteBusy}
                placeholder="RJ123456"
                onChange={(event) => {
                  setRjCode(event.target.value);
                  if (dlsiteValidationError) setDlsiteValidationError(null);
                }}
              />
              <Button variant="ghost" disabled={submitBusy || dlsiteBusy} onClick={fetchDlsite}>
                {dlsiteBusy ? <I.refresh size={12} className="motion-safe:animate-spin" /> : "取得"}
              </Button>
            </div>
            {dlsiteError && <p className="m-0 text-[11px] text-[var(--r-coral)]">{dlsiteError}</p>}

            <div className="flex items-center gap-2.5">
              {dlsiteInfo?.coverUrl ? (
                <img
                  src={dlsiteInfo.coverUrl}
                  alt=""
                  className="h-[104px] w-[104px] shrink-0 rounded-[6px] border border-line-soft object-cover"
                />
              ) : (
                <div className="flex h-[104px] w-[104px] shrink-0 flex-col items-center justify-center gap-1 rounded-[6px] border border-line-soft bg-paper-0 text-ink-4">
                  <I.image size={20} />
                  <span className="font-sans text-[10px]">なし</span>
                </div>
              )}
              <label
                className={`flex items-center gap-1.5 text-[11px] ${dlsiteInfo?.coverUrl ? "text-ink-1" : "text-ink-4"}`}
              >
                <input
                  type="checkbox"
                  checked={Boolean(dlsiteInfo?.coverUrl) && applyCover}
                  disabled={!dlsiteInfo?.coverUrl}
                  onChange={(event) => setApplyCover(event.target.checked)}
                />
                カバー画像を適用
              </label>
            </div>
          </div>

          <label className="mb-3 flex flex-col gap-1">
            <span className="flex items-center gap-1.5 font-sans text-[11px] font-medium text-ink-2">
              タイトル
              {dlsiteBusy && (
                <I.refresh size={11} className="text-ink-3 motion-safe:animate-spin" />
              )}
            </span>
            <input
              className={inputClass}
              value={title}
              disabled={submitBusy}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <div className="mb-3 flex flex-col gap-1">
            <span className="font-sans text-[11px] font-medium text-ink-2">タグ</span>
            <div className="flex flex-wrap items-start gap-1.5">
              {tags.map((tag) => (
                <Tag
                  key={tag}
                  tag={tag}
                  definition={definitionOf(tag)}
                  onRemove={submitBusy ? undefined : () => removeTag(tag)}
                />
              ))}
              {isTagInputOpen ? (
                <TagCombobox
                  focusOnMount
                  suggestions={tagSuggestions}
                  excludeTags={tags}
                  disabled={submitBusy}
                  canCreate={(tag) => normalizeTag(tag) !== null}
                  width={180}
                  onSelect={addTag}
                  onCancel={() => setIsTagInputOpen(false)}
                />
              ) : (
                <IconButton
                  icon={I.add}
                  label="タグを追加"
                  size="xs"
                  className="bg-paper-2 text-ink-2 hover:bg-paper-3 hover:text-ink-0"
                  disabled={submitBusy}
                  onClick={() => setIsTagInputOpen(true)}
                />
              )}
            </div>
          </div>

          {submitError && <p className="m-0 text-[11px] text-[var(--r-coral)]">{submitError}</p>}
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-line-soft px-[18px] py-3">
          <Button variant="ghost" disabled={submitBusy} onClick={close}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            disabled={submitBusy || title.trim().length === 0}
            onClick={() => registerMutation.mutate()}
          >
            登録
          </Button>
        </footer>
      </div>
    </dialog>,
    document.body,
  );
}
