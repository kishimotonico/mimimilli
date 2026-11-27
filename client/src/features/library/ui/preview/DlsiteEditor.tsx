import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  computeDlsiteWorkDiff,
  defaultDlsiteApplySelection,
  detectRjCode,
  pathBaseName,
  type DlsiteApplySelectionInput,
  type DlsiteCoverChange,
  type DlsitePreview,
  type DlsiteUnavailableReason,
  type DlsiteValueChange,
  type DlsiteWorkCurrent,
  type DlsiteWorkDiff,
  type WorkEditSnapshot,
  type WorkProjection,
} from "@mimimilli/shared";
import {
  dlsiteApplyErrorMessage,
  dlsiteFetchErrorMessage,
  isDlsiteApplyStale,
} from "../../../../entities/work/dlsiteFetchError";
import Button from "../../../../shared/ui/Button";
import TextInput from "../../../../shared/ui/TextInput";
import Modal, { ModalFooter, ModalHeader } from "../../../../shared/ui/Modal";
import { useDialogModal } from "../../../../shared/ui/useDialogModal";
import { DLSITE_LINKAGE_STATUS_LABEL } from "../../../../entities/work/workStatusLabel";
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

function initialRjCode(snapshot: WorkEditSnapshot): string {
  if (snapshot.dlsite.rjCode !== null) return snapshot.dlsite.rjCode;
  return detectRjCode([pathBaseName(snapshot.physicalPath), snapshot.title]) ?? "";
}

const UNAVAILABLE_REASON_LABEL: Record<DlsiteUnavailableReason, string> = {
  no_title: "DLsiteにタイトルがありません",
  no_url: "DLsiteにURLがありません",
  no_cover: "DLsiteに画像がありません",
  cover_not_cached: "画像を取得できていません",
};

/** ダイアログ1行の表示。before が現在値、after が反映後の値 */
type DlsiteRowView =
  | { kind: "change"; before: string; after: string }
  | { kind: "same"; value: string }
  | { kind: "unavailable"; before: string; reason: string };

function valueRowView(change: DlsiteValueChange): DlsiteRowView {
  switch (change.kind) {
    case "fill":
      return { kind: "change", before: "未設定", after: change.next };
    case "replace":
      return { kind: "change", before: change.current, after: change.next };
    case "unchanged":
      return { kind: "same", value: change.current };
    case "unavailable":
      return {
        kind: "unavailable",
        before: change.current ?? "未設定",
        reason: UNAVAILABLE_REASON_LABEL[change.reason],
      };
  }
}

function coverRowView(change: DlsiteCoverChange, hasCover: boolean): DlsiteRowView {
  const before = hasCover ? "設定済み" : "未設定";
  if (change.kind === "unavailable") {
    return { kind: "unavailable", before, reason: UNAVAILABLE_REASON_LABEL[change.reason] };
  }
  return { kind: "change", before, after: "DLsite画像" };
}

interface DlsiteDiffRowProps {
  label: string;
  view: DlsiteRowView;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** 変更あり／変更なし／適用不可を見た目と操作で分ける1行 */
function DlsiteDiffRow({ label, view, checked, onCheckedChange }: DlsiteDiffRowProps) {
  const current = view.kind === "same" ? view.value : view.before;
  const stateWord = view.kind === "same" ? "同一" : view.kind === "unavailable" ? "対象外" : null;
  const tooltip = view.kind === "unavailable" ? view.reason : undefined;
  return (
    <label
      title={tooltip}
      className={`grid grid-cols-[18px_60px_minmax(0,1fr)_18px_minmax(0,1fr)] items-center gap-1.5 border-b border-line-soft py-2 ${
        view.kind === "change" ? "" : "opacity-50"
      }`}
    >
      <input
        type="checkbox"
        checked={view.kind === "change" && checked}
        disabled={view.kind !== "change"}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span>{label}</span>
      <span className="min-w-0 break-words text-ink-2">{current}</span>
      <span className="text-ink-3">{view.kind === "change" ? "→" : ""}</span>
      <span className="min-w-0 break-words">
        {view.kind === "change" ? (
          <span className="font-medium text-ink-0">{view.after}</span>
        ) : (
          stateWord
        )}
      </span>
    </label>
  );
}

interface DlsiteApplyDialogProps {
  diff: DlsiteWorkDiff;
  hasCover: boolean;
  busy: boolean;
  selection: DlsiteApplySelectionInput;
  onSelectionChange: (selection: DlsiteApplySelectionInput) => void;
  onApply: () => void;
  onClose: () => void;
}

function DlsiteApplyDialog({
  diff,
  hasCover,
  busy,
  selection,
  onSelectionChange,
  onApply,
  onClose,
}: DlsiteApplyDialogProps) {
  const close = () => {
    if (!busy) onClose();
  };
  const dialog = useDialogModal({ onClose: close });
  const tagsHeadingId = useId();

  return createPortal(
    <Modal dialog={dialog} size={680} labelledBy="dlsite-apply-title">
      <ModalHeader
        title="DLsite情報の適用"
        titleId="dlsite-apply-title"
        onClose={close}
        closeDisabled={busy}
      />
      <div className="mll-selectable min-h-0 flex-1 overflow-y-auto px-[18px] py-3 text-secondary">
        <DlsiteDiffRow
          label="タイトル"
          view={valueRowView(diff.title)}
          checked={selection.title}
          onCheckedChange={(title) => onSelectionChange({ ...selection, title })}
        />
        <DlsiteDiffRow
          label="URL"
          view={valueRowView(diff.url)}
          checked={selection.url}
          onCheckedChange={(url) => onSelectionChange({ ...selection, url })}
        />
        <DlsiteDiffRow
          label="カバー"
          view={coverRowView(diff.cover, hasCover)}
          checked={selection.cover}
          onCheckedChange={(cover) => onSelectionChange({ ...selection, cover })}
        />
        {diff.tags.length > 0 && (
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- fieldset の legend は親の padding の外に置かれ、上の行と余白がそろわない
          <div role="group" aria-labelledby={tagsHeadingId} className="grid gap-1.5 py-2.5">
            <span id={tagsHeadingId} className="mb-1 font-sans font-medium">
              追加されるタグ
            </span>
            {diff.tags.map(({ tag, replaces }) => (
              <label key={tag} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={selection.tags.includes(tag)}
                  onChange={(event) =>
                    onSelectionChange({
                      ...selection,
                      tags: event.target.checked
                        ? [...selection.tags, tag]
                        : selection.tags.filter((item) => item !== tag),
                    })
                  }
                />
                <span>{tag}</span>
                {replaces.length > 0 && (
                  <span className="text-ink-3">（{replaces.join("、")} を置き換え）</span>
                )}
              </label>
            ))}
          </div>
        )}
        {diff.presentTags.length > 0 && (
          <details className="py-2 text-ink-2">
            <summary className="cursor-pointer font-sans">
              適用済みのタグ（{diff.presentTags.length}）
            </summary>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {diff.presentTags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </details>
        )}
      </div>
      <ModalFooter>
        <Button variant="quiet" disabled={busy} onClick={close}>
          キャンセル
        </Button>
        <Button variant="primary" disabled={busy} onClick={onApply}>
          選択内容を適用
        </Button>
      </ModalFooter>
    </Modal>,
    document.body,
  );
}

function currentOf(snapshot: WorkEditSnapshot): DlsiteWorkCurrent {
  return {
    title: snapshot.title,
    tags: snapshot.tags,
    urls: snapshot.urls,
    hasCover: snapshot.coverImage !== null,
  };
}

interface FetchedDlsite {
  preview: DlsitePreview;
  diff: DlsiteWorkDiff;
  hasCover: boolean;
}

export function DlsiteEditor({ workId, snapshot }: { workId: string; snapshot: WorkEditSnapshot }) {
  const linkageMutation = useUpdateDlsiteLinkageMutation();
  const fetchPreviewMutation = useFetchDlsitePreviewMutation();
  const applyMutation = useApplyDlsiteInfoMutation();
  const toast = useToast();
  const [rjCode, setRjCode] = useState(initialRjCode(snapshot));
  const [fetched, setFetched] = useState<FetchedDlsite | null>(null);
  const [selection, setSelection] = useState<DlsiteApplySelectionInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projection, setProjection] = useState<WorkProjection | null>(null);
  const rootFolder = useRootFolderOrNull();
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- 検出の再計算は作品切替と保存済みコードだけ
  useEffect(() => setRjCode(initialRjCode(snapshot)), [snapshot.id, snapshot.dlsite.rjCode]);

  const saveCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await linkageMutation.mutateAsync({
        workId,
        body: { sourceRevision: snapshot.sourceRevision, rjCode: rjCode.trim() },
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
      const code = rjCode.trim().toUpperCase();
      let current = snapshot;
      if (code !== (snapshot.dlsite.rjCode ?? "")) {
        const updated = await linkageMutation.mutateAsync({
          workId,
          body: { sourceRevision: snapshot.sourceRevision, rjCode: code },
        });
        current = updated.snapshot;
      }
      const preview = await fetchPreviewMutation.mutateAsync({ workId, rjCode: code });
      const diff = computeDlsiteWorkDiff(currentOf(current), preview.info, {
        coverCached: preview.cachedCover !== null,
      });
      if (!diff.hasChanges) {
        toast.show({
          message: "DLsiteの情報は現在の内容と同じでした",
          variant: "info",
          priority: "notice",
        });
        return;
      }
      setSelection(defaultDlsiteApplySelection(diff));
      setFetched({ preview, diff, hasCover: current.coverImage !== null });
    } catch (cause) {
      setError(dlsiteFetchErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!fetched || !selection) return;
    setBusy(true);
    setError(null);
    try {
      const result = await applyMutation.mutateAsync({
        workId,
        body: {
          sourceRevision: fetched.preview.sourceRevision,
          infoRevision: fetched.preview.infoRevision,
          apply: selection,
        },
      });
      setProjection(result.projection);
      setFetched(null);
      toast.show(
        result.coverSkipped === null
          ? { message: "DLsite情報を適用しました", variant: "success", priority: "notice" }
          : {
              message:
                result.coverSkipped === "not_cached"
                  ? "DLsite情報を適用しました。カバー画像を取得できていないため、カバーは適用できませんでした"
                  : "DLsite情報を適用しました。カバーは適用できませんでした",
              variant: "warning",
              priority: "notice",
            },
      );
    } catch (cause) {
      if (isDlsiteApplyStale(cause)) setFetched(null);
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
            {DLSITE_LINKAGE_STATUS_LABEL[snapshot.dlsite.status]}
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
      {fetched && selection && (
        <DlsiteApplyDialog
          diff={fetched.diff}
          hasCover={fetched.hasCover}
          busy={busy}
          selection={selection}
          onSelectionChange={setSelection}
          onApply={() => void apply()}
          onClose={() => setFetched(null)}
        />
      )}
    </section>
  );
}
