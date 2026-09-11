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
import { useToast } from "../../../../shared/ui/useToast";
import { I } from "../../../../shared/ui/Icon";
import { cn } from "../../../../shared/lib/cn";
import { ApiRequestError } from "../../../../shared/api/http";
import { apiErrorMessage } from "../../../../shared/lib/apiError";
import { parentDirOf } from "../../../../shared/lib/workspacePath";
import { excludeScanCandidates, registerScanCandidates, SCAN_QUERY_KEYS } from "../../api";
import { restoreScanCandidateExclusions } from "../../../../entities/scan/api";
import { refreshScanCandidates } from "../../../../entities/scan/scanCandidatesCache";
import { invalidateLibraryQueries } from "../../model/libraryInvalidation";
import { scanCandidateHiddenPathsAtom } from "../../../../entities/scan/model/atoms";
import type { CandidatesRegisteredResult } from "./types";

export interface UnregisteredTabProps {
  candidates: ScanCandidate[];
  onRegistered: (result: CandidatesRegisteredResult) => void;
}

/** 不正値の入力欄を離れても消えない、行単位のRJコードエラー。値も一緒に保持し、
 *  再度そのセルを開いたときに書きかけの内容から続けられるようにする。 */
interface FieldError {
  value: string;
  message: string;
}

export default function UnregisteredTab({ candidates, onRegistered }: UnregisteredTabProps) {
  const queryClient = useQueryClient();
  const setHiddenPaths = useSetAtom(scanCandidateHiddenPathsAtom);
  const [deselectedPaths, setDeselectedPaths] = useState<Set<string>>(() => new Set());
  const [rjCodeOverrides, setRjCodeOverrides] = useState<Map<string, string>>(() => new Map());
  const [fieldErrors, setFieldErrors] = useState<Map<string, FieldError>>(() => new Map());
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const toast = useToast();
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const editingInputRef = useRef<HTMLInputElement>(null);

  const effectiveRjCode = (candidate: ScanCandidate) =>
    rjCodeOverrides.has(candidate.path)
      ? (rjCodeOverrides.get(candidate.path) ?? "")
      : candidate.rjCode;
  const hasFieldError = (path: string) => fieldErrors.has(path);

  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => !deselectedPaths.has(candidate.path)),
    [candidates, deselectedPaths],
  );
  // 不正な値が残っている行は、選択済みでも登録対象から外す（値を確定できていないため）。
  const registerableCandidates = selectedCandidates.filter(
    (candidate) => !hasFieldError(candidate.path),
  );
  const allSelected = candidates.length > 0 && selectedCandidates.length === candidates.length;
  const partiallySelected = selectedCandidates.length > 0 && !allSelected;
  const excludedByErrorCount = selectedCandidates.length - registerableCandidates.length;

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);

  useEffect(() => {
    if (editingPath) editingInputRef.current?.focus();
  }, [editingPath]);

  const registerMutation = useMutation({
    mutationFn: registerScanCandidates,
    onSuccess: ({ registered, failures }) => {
      const registeredPaths = new Set(registered.map((entry) => entry.path));
      setHiddenPaths((previous) => new Set([...previous, ...registeredPaths]));
      setErrorMessage(
        failures.length > 0 ? `${failures.length}件はライブラリに追加できませんでした。` : null,
      );
      // 部分失敗時も、実際に登録できた分だけがサーバー側の状態。再取得で正しい件数に揃える。
      if (registered.length > 0) void invalidateLibraryQueries(queryClient);
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
      toast.show({
        message: `「${candidate.inferredTitle}」を候補から外しました`,
        variant: "success",
        actionLabel: "元に戻す",
        onAction: () => restoreMutation.mutate(candidate.path),
        priority: "action",
      });
      await queryClient.invalidateQueries({ queryKey: SCAN_QUERY_KEYS.candidateExclusions() });
    },
    onError: (error) => setErrorMessage(apiErrorMessage(error, "候補から外せませんでした")),
  });

  const restoreMutation = useMutation({
    mutationFn: (path: string) => restoreScanCandidateExclusions([path]),
    onSuccess: async (_void, path) => {
      toast.dismiss();
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

  const clearFieldError = (path: string) => {
    setFieldErrors((previous) => {
      if (!previous.has(path)) return previous;
      const next = new Map(previous);
      next.delete(path);
      return next;
    });
  };

  const startEdit = (candidate: ScanCandidate) => {
    const pending = fieldErrors.get(candidate.path);
    setEditingPath(candidate.path);
    setEditingValue(pending ? pending.value : (effectiveRjCode(candidate) ?? ""));
  };

  /** Escapeでの取り消し。保存はせず、書きかけの不正値も含めて編集を破棄する
   *  （TASK-428.13/17と同じ「1段だけ閉じる」契約）。 */
  const cancelEdit = () => {
    if (editingPath) clearFieldError(editingPath);
    setEditingPath(null);
  };

  const commitEdit = () => {
    if (editingPath === null) return;
    const path = editingPath;
    const trimmed = editingValue.trim();

    if (trimmed === "") {
      setRjCodeOverrides((previous) => new Map(previous).set(path, ""));
      clearFieldError(path);
      setEditingPath(null);
      return;
    }
    const parsed = rjCodeFormatSchema.safeParse(trimmed);
    if (!parsed.success) {
      setFieldErrors((previous) =>
        new Map(previous).set(path, {
          value: editingValue,
          message: parsed.error.issues[0]?.message ?? "RJ/VJコードの形式が正しくありません",
        }),
      );
      // blurで抜けても、行を離れたあともエラーが残るよう state で保持する一方、
      // 今まさに編集中のこの入力欄へは同期的にフォーカスを戻す（値の変化に依らず毎回効かせる）。
      editingInputRef.current?.focus();
      return;
    }
    setRjCodeOverrides((previous) => new Map(previous).set(path, parsed.data));
    clearFieldError(path);
    setEditingPath(null);
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
    const items = registerableCandidates.map((candidate) => ({
      path: candidate.path,
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
          <p className="font-jp text-secondary text-ink-2">
            まだライブラリで管理していないフォルダーです。追加すると mimimilli.json
            を作成して、作品として管理します。RJコードはフォルダー名から自動で拾い、未検出ならクリックして直せます。
          </p>
          <div className="overflow-hidden rounded-[6px] border border-line-soft">
            <table className="w-full table-fixed border-collapse text-secondary">
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
                    フォルダー名
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
                  const rjCodeEditing = editingPath === candidate.path;
                  const rjCodeError = fieldErrors.get(candidate.path);
                  const rjCode = effectiveRjCode(candidate);
                  const rjCodeDisplayValue = rjCodeError ? rjCodeError.value : rjCode;
                  const rowHasError = Boolean(rjCodeError);
                  const parentFolder = parentDirOf(candidate.path);
                  return (
                    <tr key={candidate.path}>
                      <td className="px-2.5 py-2 align-middle">
                        <input
                          type="checkbox"
                          aria-label={`「${candidate.inferredTitle}」を選択`}
                          checked={!deselectedPaths.has(candidate.path)}
                          disabled={busy || rowHasError}
                          title={
                            rowHasError
                              ? "値にエラーがあるため、直すまで登録から除外されます"
                              : undefined
                          }
                          onChange={() => toggleRow(candidate.path)}
                        />
                      </td>
                      <td className="truncate px-2.5 py-2 align-middle font-jp text-ink-0">
                        {candidate.inferredTitle}
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
                              rjCodeError ? "border-[var(--r-coral)]" : "border-acc",
                            )}
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => startEdit(candidate)}
                            title={rjCodeError?.message ?? "クリックしてRJコードを編集"}
                            className={cn(
                              "font-mono text-mono",
                              rjCodeError
                                ? "text-[var(--r-coral)]"
                                : hasRjCode({ rjCode })
                                  ? "text-ink-1"
                                  : "text-ink-4",
                            )}
                          >
                            {rjCodeError
                              ? rjCodeDisplayValue
                              : hasRjCode({ rjCode })
                                ? rjCode
                                : "未検出"}
                          </button>
                        )}
                        {rjCodeError && (
                          <p role="alert" className="font-jp text-caption text-[var(--r-coral)]">
                            {rjCodeError.message}
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
                          label={`「${candidate.inferredTitle}」を候補から外す`}
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
            <span className="font-jp text-secondary text-ink-2">
              {selectedCandidates.length}件選択中
            </span>
            <Button
              variant="primary"
              disabled={busy || registerableCandidates.length === 0}
              onClick={handleRegisterSelected}
            >
              {registerableCandidates.length}件をライブラリに追加
            </Button>
            {excludedByErrorCount > 0 && (
              <span role="alert" className="font-jp text-secondary text-[var(--r-coral)]">
                エラーのある{excludedByErrorCount}件は登録から除外されます。
              </span>
            )}
          </div>
        </>
      )}
      {errorMessage && (
        <p role="alert" className="font-jp text-secondary text-[var(--r-coral)]">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
