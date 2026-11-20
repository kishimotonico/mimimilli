import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dlsiteInfoTags, normalizeTag, rjCodeFormatSchema } from "@mimimilli/shared";
import type { DlsiteCachedCover, WorkCreateResponse, WorkRegisterPreview } from "@mimimilli/shared";
import { ApiRequestError } from "../../../shared/api/http";
import Button from "../../../shared/ui/Button";
import IconButton from "../../../shared/ui/IconButton";
import { I } from "../../../shared/ui/Icon";
import TagCombobox from "../../../shared/ui/TagCombobox";
import TextInput from "../../../shared/ui/TextInput";
import Modal, { ModalFooter, ModalHeader } from "../../../shared/ui/Modal";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { allTagsQueryOptions } from "../../../entities/tag/allTagsQueryOptions";
import { buildTagsWithAdded, buildTagsWithRemoved } from "../../../entities/work/editableTags";
import Tag from "../../../entities/work/ui/Tag";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";
import { tagPrefixDefinition } from "../../../entities/tag/tagPrefixDefinition";
import { dlsiteFetchErrorMessage } from "../../../entities/work/dlsiteFetchError";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { sourceMutationErrorMessage } from "../../../entities/work/sourceMutation";
import { getDlsiteCoverUrl } from "../../../entities/dlsite/dlsiteCoverUrl";
import { fetchDlsiteInfoByCode } from "../api";
import { useRegisterWorkMutation } from "../../../entities/work/model/workMutations";
import { updateCachesAfterDlsiteSyncFetch } from "../../../entities/work/model/workCacheUpdates";

interface RegisterWorkDialogProps {
  folderPath: string;
  targetKind?: "folder" | "file";
  preview: WorkRegisterPreview;
  onRegistered: (result: WorkCreateResponse) => void;
  onClose: () => void;
}

export default function RegisterWorkDialog({
  folderPath,
  targetKind = "folder",
  preview,
  onRegistered,
  onClose,
}: RegisterWorkDialogProps) {
  const [title, setTitle] = useState(preview.suggestedTitle);
  const [tags, setTags] = useState<string[]>(preview.tags);
  const [isTagInputOpen, setIsTagInputOpen] = useState(false);
  const [rjCode, setRjCode] = useState(preview.detectedRjCode ?? "");
  const [fetched, setFetched] = useState<{
    rjCode: string;
    cachedCover: DlsiteCachedCover | null;
  } | null>(null);
  const [applyCover, setApplyCover] = useState(true);
  const [dlsiteValidationError, setDlsiteValidationError] = useState<string | null>(null);

  const tagsQuery = useQuery(allTagsQueryOptions);
  const tagSuggestions = tagsQuery.data ?? [];
  const { tagPrefixes } = useTagPrefixes();

  const queryClient = useQueryClient();
  const dlsiteMutation = useMutation({
    mutationFn: (code: string) => fetchDlsiteInfoByCode(code),
    onSettled: (_data, _error, code) => updateCachesAfterDlsiteSyncFetch(queryClient, code),
    onSuccess: ({ info, cachedCover: cover }) => {
      setFetched({ rjCode: info.rjCode, cachedCover: cover });
      setTitle(info.title);
      setTags((prev) => Array.from(new Set([...prev, ...dlsiteInfoTags(info)])));
      setApplyCover(cover !== null);
    },
  });

  const registerMutation = useRegisterWorkMutation();
  const trimmedRjCode = rjCode.trim();
  const parsedRjCode = trimmedRjCode === "" ? null : rjCodeFormatSchema.safeParse(trimmedRjCode);
  const rjCodeInvalid = parsedRjCode !== null && !parsedRjCode.success;
  const currentFetched =
    fetched && parsedRjCode?.success && parsedRjCode.data === fetched.rjCode ? fetched : null;
  const cachedCover = currentFetched?.cachedCover ?? null;

  const register = async () => {
    if (rjCodeInvalid) {
      setDlsiteValidationError(
        parsedRjCode.error.issues[0]?.message ?? "RJ/VJコードの形式が正しくありません",
      );
      return;
    }
    let result: WorkCreateResponse;
    try {
      result = await registerMutation.mutateAsync({
        path: folderPath,
        title: title.trim(),
        tags,
        rjCode: trimmedRjCode,
        applyCover: cachedCover !== null && applyCover,
        applyUrl: currentFetched !== null,
      });
    } catch {
      return;
    }
    onRegistered(result);
    onClose();
  };

  useEffect(() => {
    setTitle(preview.suggestedTitle);
    setTags(preview.tags);
    setIsTagInputOpen(false);
    setRjCode(preview.detectedRjCode ?? "");
    setFetched(null);
    setApplyCover(true);
    setDlsiteValidationError(null);
    dlsiteMutation.reset();
    registerMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 入力の初期化はフォルダー・プレビュー単位で1回だけ行う
  }, [folderPath, preview]);

  const submitBusy = registerMutation.isPending;
  const dlsiteBusy = dlsiteMutation.isPending;

  const close = () => {
    if (!submitBusy) onClose();
  };
  const dialog = useDialogModal({ onClose: close });

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
        : apiErrorMessage(dlsiteMutation.error, "DLsite情報の取得に失敗しました")
      : null);
  const submitError = registerMutation.error
    ? sourceMutationErrorMessage(registerMutation.error, "作品の登録に失敗しました")
    : null;

  return createPortal(
    <Modal dialog={dialog} size={520} labelledBy="register-work-title">
      <ModalHeader
        title={
          targetKind === "file" ? "このファイルを作品として登録" : "このフォルダーを作品として登録"
        }
        titleId="register-work-title"
        onClose={close}
        closeDisabled={submitBusy}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-3 text-body">
        {preview.orphanedMeta && (
          <p className="mb-3 rounded-[6px] border border-line-soft bg-paper-0 px-3 py-2 text-secondary leading-[1.6] text-ink-1">
            {targetKind === "file"
              ? "このファイルには以前の登録情報が残っています。内容を引き継いで復元します。"
              : "このフォルダーには以前の登録情報が残っています。内容を引き継いで復元します。"}
          </p>
        )}

        {preview.descendantWorkCount > 0 && (
          <p className="mb-3 rounded-[6px] border border-[color-mix(in_oklch,var(--r-coral)_35%,transparent)] bg-[color-mix(in_oklch,var(--r-coral)_8%,transparent)] px-3 py-2 text-secondary leading-[1.6] text-ink-1">
            配下に登録済み作品が <b>{preview.descendantWorkCount}</b>{" "}
            件あります。先に子作品を登録解除してから親を登録してください。
          </p>
        )}

        <div className="mb-3 flex flex-col gap-2 rounded-[8px] border border-line-soft p-3">
          <span className="font-sans text-label font-medium text-ink-2">DLsite連携（任意）</span>
          <div className="flex gap-2">
            <TextInput
              font="mono"
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
          {dlsiteError && <p className="m-0 text-secondary text-[var(--r-coral)]">{dlsiteError}</p>}

          <div className="flex items-center gap-2.5">
            {cachedCover ? (
              <img
                src={getDlsiteCoverUrl(cachedCover)}
                alt=""
                className="h-[104px] w-[104px] shrink-0 rounded-[6px] border border-line-soft object-cover"
              />
            ) : (
              <div className="flex h-[104px] w-[104px] shrink-0 flex-col items-center justify-center gap-1 rounded-[6px] border border-line-soft bg-paper-0 text-ink-4">
                <I.image size={20} />
                <span className="font-sans text-caption">なし</span>
              </div>
            )}
            <label
              className={`flex items-center gap-1.5 text-secondary ${cachedCover ? "text-ink-1" : "text-ink-4"}`}
            >
              <input
                type="checkbox"
                checked={cachedCover !== null && applyCover}
                disabled={cachedCover === null}
                onChange={(event) => setApplyCover(event.target.checked)}
              />
              カバー画像を適用
            </label>
          </div>
        </div>

        <label className="mb-3 flex flex-col gap-1">
          <span className="flex items-center gap-1.5 font-sans text-label font-medium text-ink-2">
            タイトル
            {dlsiteBusy && <I.refresh size={11} className="text-ink-3 motion-safe:animate-spin" />}
          </span>
          <TextInput
            value={title}
            disabled={submitBusy}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <div className="mb-3 flex flex-col gap-1">
          <span className="font-sans text-label font-medium text-ink-2">タグ</span>
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

        {submitError && <p className="m-0 text-secondary text-[var(--r-coral)]">{submitError}</p>}
      </div>

      <ModalFooter>
        <Button variant="quiet" disabled={submitBusy} onClick={close}>
          キャンセル
        </Button>
        <Button
          variant="primary"
          disabled={submitBusy || title.trim().length === 0 || preview.descendantWorkCount > 0}
          onClick={() => void register()}
        >
          登録
        </Button>
      </ModalFooter>
    </Modal>,
    document.body,
  );
}
