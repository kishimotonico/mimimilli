import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rjCodeFormatSchema, type ScanCandidate } from "@mimimilli/shared";
import { apiErrorMessage } from "../../../../../shared/lib/apiError";
import { useLatest } from "../../../../../shared/lib/useLatest";
import { refreshScanCandidatesQuietly } from "../../../../../entities/scan/scanCandidatesCache";
import { setScanCandidateRjCode } from "../../../api";
import { isCandidatesStale, STALE_MESSAGE } from "../../../model/candidatesStale";
import type { RjCodeCommitResult, RjCodeFieldError } from "./RjCodeCell";

const RJ_CODE_FORMAT_REASON = "RJ/VJ＋6〜8桁の数字";

interface UseRjCodeEditingOptions {
  candidates: readonly ScanCandidate[];
  /** 保存の成否の表示。成功は null で消す */
  onMessage: (message: string | null) => void;
}

/** 未登録の候補のRJコードのインライン編集。保存の応答は、保存した行の編集だけを終える。 */
export function useRjCodeEditing({ candidates, onMessage }: UseRjCodeEditingOptions) {
  const queryClient = useQueryClient();
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ReadonlyMap<string, RjCodeFieldError>>(
    () => new Map(),
  );

  const clearFieldError = useCallback((path: string) => {
    setFieldErrors((previous) => {
      if (!previous.has(path)) return previous;
      const next = new Map(previous);
      next.delete(path);
      return next;
    });
  }, []);
  const finishEdit = useCallback(
    (path: string) => setEditingPath((current) => (current === path ? null : current)),
    [],
  );

  const mutation = useMutation({
    mutationFn: ({ path, rjCode }: { path: ScanCandidate["path"]; rjCode: string }) =>
      setScanCandidateRjCode(path, rjCode),
    onSuccess: (candidate, { path }) => {
      void refreshScanCandidatesQuietly(queryClient, { replace: candidate });
      clearFieldError(path);
      finishEdit(path);
      onMessage(null);
    },
    onError: async (error, { path }) => {
      onMessage(
        isCandidatesStale(error)
          ? STALE_MESSAGE
          : apiErrorMessage(error, "RJコードを直せませんでした"),
      );
      finishEdit(path);
      if (isCandidatesStale(error)) await refreshScanCandidatesQuietly(queryClient);
    },
  });
  const savingPath = mutation.isPending ? (mutation.variables?.path ?? null) : null;
  const latest = useLatest({ candidates, savingPath });
  const save = mutation.mutate;

  const commitEdit = useCallback(
    (path: string, rawValue: string): RjCodeCommitResult => {
      const { candidates: current, savingPath: saving } = latest.current;
      if (saving !== null) return "done";
      const candidate = current.find((entry) => entry.path === path);
      if (!candidate) {
        finishEdit(path);
        return "done";
      }
      const trimmed = rawValue.trim();
      if (trimmed === "") {
        if (candidate.rjCode === null) {
          clearFieldError(path);
          finishEdit(path);
        } else {
          save({ path: candidate.path, rjCode: "" });
        }
        return "done";
      }
      const parsed = rjCodeFormatSchema.safeParse(trimmed);
      if (!parsed.success) {
        setFieldErrors((previous) =>
          new Map(previous).set(path, { value: rawValue, message: RJ_CODE_FORMAT_REASON }),
        );
        return "invalid";
      }
      if (parsed.data === candidate.rjCode) {
        clearFieldError(path);
        finishEdit(path);
        return "done";
      }
      save({ path: candidate.path, rjCode: parsed.data });
      return "done";
    },
    [latest, finishEdit, clearFieldError, save],
  );

  const startEdit = useCallback((path: string) => setEditingPath(path), []);
  const cancelEdit = useCallback(
    (path: string) => {
      clearFieldError(path);
      finishEdit(path);
    },
    [clearFieldError, finishEdit],
  );

  return { editingPath, fieldErrors, savingPath, startEdit, commitEdit, cancelEdit };
}
