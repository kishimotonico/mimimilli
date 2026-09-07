import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useSetAtom } from "jotai";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hasRjCode, rjCodeFormatSchema, type ScanCandidate } from "@mimimilli/shared";
import Button from "../../../../shared/ui/Button";
import IconButton from "../../../../shared/ui/IconButton";
import Toast from "../../../../shared/ui/Toast";
import { I } from "../../../../shared/ui/Icon";
import { cn } from "../../../../shared/lib/cn";
import { ApiRequestError } from "../../../../shared/api/http";
import { apiErrorMessage } from "../../../../shared/lib/apiError";
import { parentDirOf } from "../../../../shared/lib/workspacePath";
import { excludeScanCandidates, registerScanCandidates, SCAN_QUERY_KEYS } from "../../api";
import { restoreScanCandidateExclusions } from "../../../../entities/scan/api";
import { refreshScanCandidates } from "../../../../entities/scan/scanCandidatesCache";
import { scanCandidateHiddenPathsAtom } from "../../../../entities/scan/model/atoms";
import type { CandidatesRegisteredResult } from "./types";

export interface UnregisteredTabProps {
  candidates: ScanCandidate[];
  onRegistered: (result: CandidatesRegisteredResult) => void;
}

interface ExcludeToast {
  path: string;
  title: string;
}

/** 候補行のインライン編集対象。1度に編集できるセルは1つだけ。 */
interface EditingField {
  path: string;
  field: "title" | "rjCode";
}

export default function UnregisteredTab({ candidates, onRegistered }: UnregisteredTabProps) {
  const queryClient = useQueryClient();
  const setHiddenPaths = useSetAtom(scanCandidateHiddenPathsAtom);
  const [deselectedPaths, setDeselectedPaths] = useState<Set<string>>(() => new Set());
  const [titleOverrides, setTitleOverrides] = useState<Map<string, string>>(() => new Map());
  const [rjCodeOverrides, setRjCodeOverrides] = useState<Map<string, string>>(() => new Map());
  const [editingField, setEditingField] = useState<EditingField | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingError, setEditingError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [excludeToast, setExcludeToast] = useState<ExcludeToast | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const editingInputRef = useRef<HTMLInputElement>(null);

  const effectiveTitle = (candidate: ScanCandidate) =>
    titleOverrides.get(candidate.path) ?? candidate.inferredTitle;
  const effectiveRjCode = (candidate: ScanCandidate) =>
    rjCodeOverrides.has(candidate.path)
      ? (rjCodeOverrides.get(candidate.path) ?? "")
      : candidate.rjCode;

  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => !deselectedPaths.has(candidate.path)),
    [candidates, deselectedPaths],
  );
  const allSelected = candidates.length > 0 && selectedCandidates.length === candidates.length;
  const partiallySelected = selectedCandidates.length > 0 && !allSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);

  // 編集開始時にフォーカスする。不正値のまま確定・blurされたときはeditingFieldを維持したまま
  // editingErrorだけが変わるので、この依存配列でフォーカスも一緒に戻す。
  useEffect(() => {
    if (editingField) editingInputRef.current?.focus();
  }, [editingField, editingError]);

  const registerMutation = useMutation({
    mutationFn: registerScanCandidates,
    onSuccess: ({ registered, failures }) => {
      const registeredPaths = new Set(registered.map((entry) => entry.path));
      setHiddenPaths((previous) => new Set([...previous, ...registeredPaths]));
      setErrorMessage(
        failures.length > 0 ? `${failures.length}件はライブラリに追加できませんでした。` : null,
      );
      onRegistered({
        registeredWorkIds: registered.map((entry) => entry.workId),
        failedCount: failures.length,
        remainingCount: candidates.length - registeredPaths.size,
      });
    },
    onError: async (error) => {
      if (error instanceof ApiRequestError && error.status === 409) {
        setErrorMessage("候補が更新されたため表示を更新しました。選び直してください。");
        await refreshScanCandidates(queryClient);
        return;
      }
      setErrorMessage(apiErrorMessage(error, "ライブラリへの追加に失敗しました"));
    },
  });

  const excludeMutation = useMutation({
    mutationFn: (candidate: ScanCandidate) => excludeScanCandidates([candidate.path]),
    onSuccess: async (_void, candidate) => {
      setHiddenPaths((previous) => new Set(previous).add(candidate.path));
      setExcludeToast({ path: candidate.path, title: effectiveTitle(candidate) });
      await queryClient.invalidateQueries({ queryKey: SCAN_QUERY_KEYS.candidateExclusions() });
    },
    onError: (error) => setErrorMessage(apiErrorMessage(error, "候補から外せませんでした")),
  });

  const restoreMutation = useMutation({
    mutationFn: (path: string) => restoreScanCandidateExclusions([path]),
    onSuccess: async (_void, path) => {
      setExcludeToast(null);
      setHiddenPaths((previous) => {
        if (!previous.has(path)) return previous;
        const next = new Set(previous);
        next.delete(path);
        return next;
      });
      await refreshScanCandidates(queryClient);
    },
    onError: (error) => setErrorMessage(apiErrorMessage(error, "取り消しに失敗しました")),
  });

  const busy = registerMutation.isPending || excludeMutation.isPending || restoreMutation.isPending;

  const toggleAll = () => {
    setDeselectedPaths(
      allSelected ? new Set(candidates.map((candidate) => candidate.path)) : new Set(),
    );
  };

  const toggleRow = (path: string) => {
    setDeselectedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const startEdit = (candidate: ScanCandidate, field: EditingField["field"]) => {
    setEditingField({ path: candidate.path, field });
    setEditingValue(
      field === "title" ? effectiveTitle(candidate) : (effectiveRjCode(candidate) ?? ""),
    );
    setEditingError(null);
  };

  /** Escapeでの取り消し。保存はせず編集モードだけを閉じる（TASK-428.13/17と同じ契約）。 */
  const cancelEdit = () => {
    setEditingField(null);
    setEditingError(null);
  };

  const commitEdit = () => {
    if (editingField === null) return;
    const { path, field } = editingField;
    const trimmed = editingValue.trim();

    if (field === "title") {
      if (!trimmed) {
        setEditingError("タイトルを入力してください");
        return;
      }
      setTitleOverrides((previous) => new Map(previous).set(path, trimmed));
      setEditingField(null);
      setEditingError(null);
      return;
    }

    if (trimmed === "") {
      setRjCodeOverrides((previous) => new Map(previous).set(path, ""));
      setEditingField(null);
      setEditingError(null);
      return;
    }
    const parsed = rjCodeFormatSchema.safeParse(trimmed);
    if (!parsed.success) {
      setEditingError(parsed.error.issues[0]?.message ?? "RJ/VJコードの形式が正しくありません");
      return;
    }
    setRjCodeOverrides((previous) => new Map(previous).set(path, parsed.data));
    setEditingField(null);
    setEditingError(null);
  };

  const handleEditKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") commitEdit();
    if (event.key === "Escape") {
      // 入力欄側で編集を取り消し、モーダルのEscapeクローズ（<dialog>のcancel既定動作）
      // まで伝播させない。親は編集中かどうかを知らなくてよい。
      event.preventDefault();
      event.stopPropagation();
      cancelEdit();
    }
  };

  const handleRegisterSelected = () => {
    const items = selectedCandidates.map((candidate) => ({
      path: candidate.path,
      title: effectiveTitle(candidate),
      rjCode: effectiveRjCode(candidate) ?? "",
    }));
    registerMutation.mutate(items);
  };

  return (
    <div className="flex flex-col gap-3">
      {candidates.length === 0 ? (
        <p className="font-jp text-body text-ink-2">未登録の候補はありません。</p>
      ) : (
        <>
          <p className="font-jp text-[11.5px] text-ink-2">
            まだライブラリで管理していないフォルダーです。追加すると mimimilli.json
            を作成して、作品として管理します。タイトル・RJコードはフォルダー名から自動で拾い、クリックして直せます。
          </p>
          <div className="overflow-hidden rounded-[6px] border border-line-soft">
            <table className="w-full table-fixed border-collapse text-[11px]">
              <colgroup>
                <col className="w-[32px]" />
                <col className="w-[26%]" />
                <col className="w-[112px]" />
                <col />
                <col className="w-[56px]" />
                <col className="w-[32px]" />
              </colgroup>
              <thead>
                <tr className="bg-paper-0 text-left">
                  <th className="border-b border-line-soft px-2.5 py-1.5">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      aria-label="すべて選択"
                      checked={allSelected}
                      disabled={busy}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="border-b border-line-soft px-2.5 py-1.5 font-sans font-semibold text-ink-2">
                    タイトル
                  </th>
                  <th className="border-b border-line-soft px-2.5 py-1.5 font-sans font-semibold text-ink-2">
                    RJコード
                  </th>
                  <th className="border-b border-line-soft px-2.5 py-1.5 font-sans font-semibold text-ink-2">
                    フォルダー
                  </th>
                  <th className="border-b border-line-soft px-2.5 py-1.5 font-sans font-semibold text-ink-2">
                    音声
                  </th>
                  <th className="border-b border-line-soft px-2.5 py-1.5">
                    <span className="sr-only">操作</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {candidates.map((candidate) => {
                  const titleEditing =
                    editingField?.path === candidate.path && editingField.field === "title";
                  const rjCodeEditing =
                    editingField?.path === candidate.path && editingField.field === "rjCode";
                  const title = effectiveTitle(candidate);
                  const rjCode = effectiveRjCode(candidate);
                  const parentFolder = parentDirOf(candidate.path);
                  return (
                    <tr key={candidate.path}>
                      <td className="px-2.5 py-2 align-middle">
                        <input
                          type="checkbox"
                          aria-label={`「${title}」を選択`}
                          checked={!deselectedPaths.has(candidate.path)}
                          disabled={busy}
                          onChange={() => toggleRow(candidate.path)}
                        />
                      </td>
                      <td className="px-2.5 py-2 align-middle">
                        {titleEditing ? (
                          <input
                            ref={editingInputRef}
                            value={editingValue}
                            onChange={(event) => setEditingValue(event.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleEditKeyDown}
                            placeholder="タイトル"
                            className={cn(
                              "w-full min-w-0 rounded-[4px] border bg-paper-2 px-1.5 py-0.5 font-jp text-body text-ink-0",
                              editingError ? "border-[var(--r-coral)]" : "border-acc",
                            )}
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => startEdit(candidate, "title")}
                            title="クリックしてタイトルを編集"
                            className="w-full min-w-0 truncate text-left font-jp text-ink-0"
                          >
                            {title}
                          </button>
                        )}
                        {titleEditing && editingError && (
                          <p role="alert" className="font-jp text-[9.5px] text-[var(--r-coral)]">
                            {editingError}
                          </p>
                        )}
                      </td>
                      <td className="px-2.5 py-2 align-middle">
                        {rjCodeEditing ? (
                          <input
                            ref={editingInputRef}
                            value={editingValue}
                            onChange={(event) => setEditingValue(event.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleEditKeyDown}
                            placeholder="RJコード"
                            className={cn(
                              "w-full min-w-0 rounded-[4px] border bg-paper-2 px-1.5 py-0.5 font-mono text-mono text-ink-0",
                              editingError ? "border-[var(--r-coral)]" : "border-acc",
                            )}
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => startEdit(candidate, "rjCode")}
                            title="クリックしてRJコードを編集"
                            className={cn(
                              "font-mono text-[10.5px]",
                              hasRjCode({ rjCode }) ? "text-ink-1" : "text-ink-4",
                            )}
                          >
                            {hasRjCode({ rjCode }) ? rjCode : "未検出"}
                          </button>
                        )}
                        {rjCodeEditing && editingError && (
                          <p role="alert" className="font-jp text-[9.5px] text-[var(--r-coral)]">
                            {editingError}
                          </p>
                        )}
                      </td>
                      <td
                        className="px-2.5 py-2 align-middle font-mono text-caption text-ink-2"
                        title={parentFolder ?? undefined}
                      >
                        {parentFolder ? (
                          <span dir="rtl" className="mll-selectable block truncate text-left">
                            {parentFolder}
                          </span>
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 align-middle whitespace-nowrap text-ink-2">
                        {candidate.audioFileCount}件
                      </td>
                      <td className="px-2.5 py-2 align-middle">
                        <IconButton
                          icon={I.x}
                          label={`「${title}」を候補から外す`}
                          size="xs"
                          disabled={busy}
                          onClick={() => excludeMutation.mutate(candidate)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-jp text-[11px] text-ink-2">
              {selectedCandidates.length}件選択中
            </span>
            <Button
              variant="primary"
              disabled={busy || selectedCandidates.length === 0}
              onClick={handleRegisterSelected}
            >
              {selectedCandidates.length}件をライブラリに追加
            </Button>
          </div>
        </>
      )}
      {errorMessage && (
        <p role="alert" className="font-jp text-[11px] text-[var(--r-coral)]">
          {errorMessage}
        </p>
      )}
      <Toast
        message={excludeToast ? `「${excludeToast.title}」を候補から外しました` : null}
        variant="success"
        actionLabel="元に戻す"
        onAction={() => excludeToast && restoreMutation.mutate(excludeToast.path)}
        onDismiss={() => setExcludeToast(null)}
      />
    </div>
  );
}
