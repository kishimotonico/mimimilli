import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  refreshScanCandidates,
  updateScanCandidatesCache,
} from "../../../../entities/scan/scanCandidatesCache";
import type { CandidatesRegisteredResult } from "./types";

export interface UnregisteredTabProps {
  candidates: ScanCandidate[];
  onRegistered: (result: CandidatesRegisteredResult) => void;
}

interface ExcludeToast {
  path: string;
  title: string;
}

export default function UnregisteredTab({ candidates, onRegistered }: UnregisteredTabProps) {
  const queryClient = useQueryClient();
  const [deselectedPaths, setDeselectedPaths] = useState<Set<string>>(() => new Set());
  const [rjCodeOverrides, setRjCodeOverrides] = useState<Map<string, string>>(() => new Map());
  const [rjCodeErrors, setRjCodeErrors] = useState<Map<string, string>>(() => new Map());
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [excludeToast, setExcludeToast] = useState<ExcludeToast | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const rjCodeInputRef = useRef<HTMLInputElement>(null);

  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => !deselectedPaths.has(candidate.path)),
    [candidates, deselectedPaths],
  );
  const allSelected = candidates.length > 0 && selectedCandidates.length === candidates.length;
  const partiallySelected = selectedCandidates.length > 0 && !allSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);

  useEffect(() => {
    if (editingPath) rjCodeInputRef.current?.focus();
  }, [editingPath]);

  const registerMutation = useMutation({
    mutationFn: registerScanCandidates,
    onSuccess: ({ registered, failures }) => {
      const registeredPaths = new Set(registered.map((entry) => entry.path));
      updateScanCandidatesCache(queryClient, (previous) =>
        previous.filter((candidate) => !registeredPaths.has(candidate.path)),
      );
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
      updateScanCandidatesCache(queryClient, (previous) =>
        previous.filter((entry) => entry.path !== candidate.path),
      );
      setExcludeToast({ path: candidate.path, title: candidate.inferredTitle });
      await queryClient.invalidateQueries({ queryKey: SCAN_QUERY_KEYS.candidateExclusions() });
    },
    onError: (error) => setErrorMessage(apiErrorMessage(error, "候補から外せませんでした")),
  });

  const restoreMutation = useMutation({
    mutationFn: (path: string) => restoreScanCandidateExclusions([path]),
    onSuccess: async () => {
      setExcludeToast(null);
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

  const startEdit = (candidate: ScanCandidate) => {
    setEditingPath(candidate.path);
    setEditingValue(rjCodeOverrides.get(candidate.path) ?? candidate.rjCode ?? "");
  };

  const commitEdit = () => {
    if (editingPath === null) return;
    const path = editingPath;
    const value = editingValue.trim();
    if (value === "") {
      setRjCodeOverrides((previous) => new Map(previous).set(path, ""));
      setRjCodeErrors((previous) => {
        if (!previous.has(path)) return previous;
        const next = new Map(previous);
        next.delete(path);
        return next;
      });
      setEditingPath(null);
      return;
    }
    const parsed = rjCodeFormatSchema.safeParse(value);
    if (!parsed.success) {
      setRjCodeOverrides((previous) => new Map(previous).set(path, value));
      setRjCodeErrors((previous) =>
        new Map(previous).set(
          path,
          parsed.error.issues[0]?.message ?? "RJ/VJコードの形式が正しくありません",
        ),
      );
      setEditingPath(null);
      return;
    }
    setRjCodeOverrides((previous) => new Map(previous).set(path, parsed.data));
    setRjCodeErrors((previous) => {
      if (!previous.has(path)) return previous;
      const next = new Map(previous);
      next.delete(path);
      return next;
    });
    setEditingPath(null);
  };

  const selectedRjCodeErrorCount = selectedCandidates.filter((candidate) =>
    rjCodeErrors.has(candidate.path),
  ).length;

  const handleRegisterSelected = () => {
    if (selectedRjCodeErrorCount > 0) return;
    const items = selectedCandidates.map((candidate) => ({
      path: candidate.path,
      rjCode: rjCodeOverrides.get(candidate.path) ?? candidate.rjCode ?? "",
    }));
    registerMutation.mutate(items);
  };

  return (
    <div className="flex flex-col gap-3">
      {candidates.length === 0 ? (
        <p className="font-jp text-[12px] text-ink-3">未登録の候補はありません。</p>
      ) : (
        <>
          <p className="font-jp text-[11.5px] text-ink-2">
            まだライブラリで管理していないフォルダーです。追加すると mimimilli.json
            を作成して、作品として管理します。RJコードはフォルダー名から自動で拾い、未検出なら手入力できます。
          </p>
          <div className="overflow-hidden rounded-[6px] border border-line-soft">
            <table className="w-full table-fixed border-collapse text-[11px]">
              <colgroup>
                <col className="w-[32px]" />
                <col className="w-[26%]" />
                <col className="w-[104px]" />
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
                  const editing = editingPath === candidate.path;
                  const effectiveRjCode = rjCodeOverrides.has(candidate.path)
                    ? (rjCodeOverrides.get(candidate.path) ?? "")
                    : candidate.rjCode;
                  const rjCodeError = rjCodeErrors.get(candidate.path);
                  const parentFolder = parentDirOf(candidate.path);
                  return (
                    <tr key={candidate.path}>
                      <td className="px-2.5 py-2 align-middle">
                        <input
                          type="checkbox"
                          aria-label={`「${candidate.inferredTitle}」を選択`}
                          checked={!deselectedPaths.has(candidate.path)}
                          disabled={busy}
                          onChange={() => toggleRow(candidate.path)}
                        />
                      </td>
                      <td className="truncate px-2.5 py-2 align-middle text-ink-0">
                        {candidate.inferredTitle}
                      </td>
                      <td className="px-2.5 py-2 align-middle">
                        {editing ? (
                          <input
                            ref={rjCodeInputRef}
                            value={editingValue}
                            onChange={(event) => setEditingValue(event.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") commitEdit();
                            }}
                            placeholder="RJコード"
                            className="w-full min-w-0 rounded-[4px] border border-acc bg-paper-2 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-0 outline-none"
                          />
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => startEdit(candidate)}
                              title={rjCodeError ?? "クリックしてRJコードを編集"}
                              className={cn(
                                "font-mono text-[10.5px]",
                                rjCodeError
                                  ? "text-[var(--r-coral)]"
                                  : hasRjCode({ rjCode: effectiveRjCode })
                                    ? "text-ink-1"
                                    : "text-ink-4",
                              )}
                            >
                              {hasRjCode({ rjCode: effectiveRjCode }) ? effectiveRjCode : "未検出"}
                            </button>
                            {rjCodeError && (
                              <p className="font-jp text-[9.5px] text-[var(--r-coral)]">
                                {rjCodeError}
                              </p>
                            )}
                          </>
                        )}
                      </td>
                      <td
                        className="px-2.5 py-2 align-middle font-mono text-[10px] text-ink-3"
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
            <span className="font-jp text-[11px] text-ink-2">
              {selectedCandidates.length}件選択中
            </span>
            <Button
              variant="primary"
              disabled={busy || selectedCandidates.length === 0 || selectedRjCodeErrorCount > 0}
              onClick={handleRegisterSelected}
            >
              {selectedCandidates.length}件をライブラリに追加
            </Button>
            {selectedRjCodeErrorCount > 0 && (
              <span role="alert" className="font-jp text-[11px] text-[var(--r-coral)]">
                RJコードの形式が正しくない項目が{selectedRjCodeErrorCount}
                件あります。修正してください。
              </span>
            )}
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
        actionLabel="元に戻す"
        onAction={() => excludeToast && restoreMutation.mutate(excludeToast.path)}
        onDismiss={() => setExcludeToast(null)}
      />
    </div>
  );
}
