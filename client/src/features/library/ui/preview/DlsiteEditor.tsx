import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  detectRjCode,
  type DlsitePreview,
  type Work,
  type WorkEditSnapshot,
  type WorkProjection,
} from "@mimimilli/shared";
import {
  dlsiteApplyErrorMessage,
  dlsiteFetchErrorMessage,
} from "../../../../entities/work/dlsiteFetchError";
import Button from "../../../../shared/ui/Button";
import IconButton from "../../../../shared/ui/IconButton";
import { I } from "../../../../shared/ui/Icon";
import TextInput from "../../../../shared/ui/TextInput";
import { useDialogModal } from "../../../../shared/ui/useDialogModal";
import { SourceProjectionNotice } from "../../../../entities/work/ui/SourceProjectionNotice";
import {
  projectionWorkspacePath,
  sourceMutationErrorMessage,
} from "../../../../entities/work/sourceMutation";
import { useRootFolderOrNull } from "../../../../entities/settings/useSettingsQuery";
import {
  useApplyDlsiteInfoMutation,
  useFetchDlsitePreviewMutation,
  useUpdateDlsiteLinkageMutation,
} from "../../../../entities/work/model/workMutations";
import { useToast } from "../../../../shared/ui/useToast";
import {
  buildDlsiteApplyBody,
  computeDlsiteApplyDiff,
  type DlsiteApplyDiff,
  type DlsiteFieldDiff,
} from "../../../../entities/work/dlsitePreview";

export const STATUS_LABEL = {
  none: "未連携",
  applied: "連携済み",
  not_found: "見つかりません",
  error: "取得エラー",
  skipped: "連携しない",
} as const;

function folderNameOf(physicalPath: string): string {
  const cut = Math.max(physicalPath.lastIndexOf("/"), physicalPath.lastIndexOf("\\"));
  return cut < 0 ? physicalPath : physicalPath.slice(cut + 1);
}

function initialRjCode(snapshot: WorkEditSnapshot): string {
  if (snapshot.dlsite.rjCode !== null) return snapshot.dlsite.rjCode;
  return detectRjCode([folderNameOf(snapshot.physicalPath), snapshot.title]) ?? "";
}

interface DlsiteDiffRowProps {
  label: string;
  diff: DlsiteFieldDiff;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** 変更あり／変更なし／適用不可を見た目と操作で分ける1行 */
function DlsiteDiffRow({ label, diff, checked, onCheckedChange }: DlsiteDiffRowProps) {
  const current = diff.kind === "unchanged" ? diff.value : diff.current;
  const stateWord =
    diff.kind === "unchanged" ? "同一" : diff.kind === "unavailable" ? "対象外" : null;
  const tooltip = diff.kind === "unavailable" ? diff.reason : undefined;
  return (
    <label
      title={tooltip}
      className={`grid grid-cols-[18px_60px_minmax(0,1fr)_18px_minmax(0,1fr)] items-center gap-1.5 border-b border-line-soft py-2 ${
        diff.kind === "changed" ? "" : "opacity-50"
      }`}
    >
      <input
        type="checkbox"
        checked={diff.kind === "changed" && checked}
        disabled={diff.kind !== "changed"}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span>{label}</span>
      <span className="min-w-0 break-words text-ink-2">{current}</span>
      <span className="text-ink-3">{diff.kind === "changed" ? "→" : ""}</span>
      <span className="min-w-0 break-words">
        {diff.kind === "changed" ? (
          <span className="font-medium text-ink-0">{diff.next}</span>
        ) : (
          stateWord
        )}
      </span>
    </label>
  );
}

interface DlsiteApplyDialogProps {
  diff: DlsiteApplyDiff;
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
  diff,
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
        <div className="mll-selectable min-h-0 flex-1 overflow-y-auto px-[18px] py-3 text-secondary">
          <DlsiteDiffRow
            label="タイトル"
            diff={diff.title}
            checked={applyTitle}
            onCheckedChange={onApplyTitleChange}
          />
          <DlsiteDiffRow
            label="URL"
            diff={diff.url}
            checked={applyUrl}
            onCheckedChange={onApplyUrlChange}
          />
          <DlsiteDiffRow
            label="カバー"
            diff={diff.cover}
            checked={applyCover}
            onCheckedChange={onApplyCoverChange}
          />
          {diff.newTags.length > 0 && (
            <fieldset className="grid gap-1.5 py-2.5">
              <legend className="mb-1 font-sans font-medium">追加されるタグ</legend>
              {diff.newTags.map((tag) => (
                <label key={tag} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={(event) =>
                      onSelectedTagsChange(
                        event.target.checked
                          ? [...selectedTags, tag]
                          : selectedTags.filter((item) => item !== tag),
                      )
                    }
                  />
                  <span>{tag}</span>
                </label>
              ))}
            </fieldset>
          )}
          {diff.appliedTags.length > 0 && (
            <details className="py-2 text-ink-2">
              <summary className="cursor-pointer font-sans">
                適用済みのタグ（{diff.appliedTags.length}）
              </summary>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {diff.appliedTags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </details>
          )}
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

export function DlsiteEditor({ workId, snapshot }: { workId: string; snapshot: WorkEditSnapshot }) {
  const linkageMutation = useUpdateDlsiteLinkageMutation();
  const fetchPreviewMutation = useFetchDlsitePreviewMutation();
  const applyMutation = useApplyDlsiteInfoMutation();
  const toast = useToast();
  const [rjCode, setRjCode] = useState(initialRjCode(snapshot));
  const [preview, setPreview] = useState<DlsitePreview | null>(null);
  const [applyTitle, setApplyTitle] = useState(false);
  const [applyCover, setApplyCover] = useState(true);
  const [applyUrl, setApplyUrl] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projection, setProjection] = useState<WorkProjection | null>(null);
  const rootFolder = useRootFolderOrNull();
  const diffSource: Pick<Work, "title" | "tags" | "urls" | "coverKind" | "coverImage" | "cover"> = {
    title: snapshot.title,
    tags: snapshot.tags,
    urls: snapshot.urls,
    coverKind: snapshot.coverImage ? "unmeasured" : "none",
    coverImage: snapshot.coverImage,
    cover: null,
  };
  const diff = preview ? computeDlsiteApplyDiff(diffSource, preview.info) : null;

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- 検出の再計算は作品切替と保存済みコードだけ
  useEffect(() => setRjCode(initialRjCode(snapshot)), [snapshot.id, snapshot.dlsite.rjCode]);

  const saveCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await linkageMutation.mutateAsync({
        workId,
        body: { sourceRevision: snapshot.sourceRevision, rjCode: rjCode.trim() || null },
      });
      setProjection(result.projection);
    } catch (cause) {
      setError(sourceMutationErrorMessage(cause, "コードを保存できませんでした"));
    } finally {
      setBusy(false);
    }
  };

  const fetchInfo = async () => {
    setBusy(true);
    setError(null);
    try {
      let current = snapshot;
      if (rjCode.trim().toUpperCase() !== snapshot.dlsite.rjCode) {
        const updated = await linkageMutation.mutateAsync({
          workId,
          body: { sourceRevision: snapshot.sourceRevision, rjCode: rjCode.trim() || null },
        });
        current = updated.snapshot;
      }
      const nextPreview = await fetchPreviewMutation.mutateAsync(workId);
      const nextDiff = computeDlsiteApplyDiff(
        {
          title: current.title,
          tags: current.tags,
          urls: current.urls,
          coverKind: current.coverImage ? "unmeasured" : "none",
          coverImage: current.coverImage,
          cover: null,
        },
        nextPreview.info,
      );
      if (!nextDiff.hasChanges) {
        toast.show({
          message: "DLsiteの情報は現在の内容と同じでした",
          variant: "info",
          priority: "notice",
        });
        return;
      }
      setSelectedTags(nextDiff.newTags);
      setApplyTitle(false);
      setApplyCover(!current.coverImage && Boolean(nextPreview.info.coverUrl));
      setApplyUrl(!current.urls.some((entry) => entry.url.includes("dlsite.com")));
      setPreview(nextPreview);
    } catch (cause) {
      setError(dlsiteFetchErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const result = await applyMutation.mutateAsync({
        workId,
        body: buildDlsiteApplyBody(preview.info, {
          sourceRevision: preview.sourceRevision,
          applyTitle,
          applyCover,
          applyUrl,
          applyTags: selectedTags,
        }),
      });
      setProjection(result.projection);
      setPreview(null);
      toast.show({ message: "DLsite情報を適用しました", variant: "success", priority: "notice" });
    } catch (cause) {
      setError(dlsiteApplyErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const toggleSkipped = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await linkageMutation.mutateAsync({
        workId,
        body: {
          sourceRevision: snapshot.sourceRevision,
          skipped: snapshot.dlsite.status !== "skipped",
        },
      });
      setProjection(result.projection);
    } catch (cause) {
      setError(sourceMutationErrorMessage(cause, "連携設定を変更できませんでした"));
    } finally {
      setBusy(false);
    }
  };

  const statusTone =
    snapshot.dlsite.status === "applied"
      ? "bg-[color-mix(in_oklch,var(--r-leaf)_12%,transparent)] text-[var(--r-leaf)]"
      : "bg-paper-3 text-ink-2";

  return (
    <section aria-labelledby="work-edit-dlsite-title" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 id="work-edit-dlsite-title" className="font-sans text-label font-semibold text-ink-1">
            DLsite連携
          </h3>
          <span className={`rounded-pill px-2 py-0.5 font-sans text-label ${statusTone}`}>
            {STATUS_LABEL[snapshot.dlsite.status]}
          </span>
        </div>
        <label className="flex items-center gap-1.5 font-jp text-secondary text-ink-2">
          <input
            type="checkbox"
            checked={snapshot.dlsite.status === "skipped"}
            disabled={busy}
            onChange={() => void toggleSkipped()}
          />
          この作品は連携しない
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          aria-label="DLsite RJ/VJコード"
          font="mono"
          className="min-w-[150px] flex-1"
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
          disabled={busy || !rjCode.trim() || snapshot.dlsite.status === "skipped"}
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
      <SourceProjectionNotice
        projection={projection}
        path={rootFolder ? projectionWorkspacePath(snapshot, rootFolder) : null}
        onProjected={(result) => setProjection(result.projection)}
      />
      {diff && (
        <DlsiteApplyDialog
          diff={diff}
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
