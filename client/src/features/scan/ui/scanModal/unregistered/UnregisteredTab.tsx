import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  rjCodeFormatSchema,
  type DlsiteRegistrationApply,
  type ScanCandidate,
} from "@mimimilli/shared";
import { ApiRequestError } from "../../../../../shared/api/http";
import { apiErrorMessage } from "../../../../../shared/lib/apiError";
import { useToast } from "../../../../../shared/ui/useToast";
import { useVirtualList } from "../../../../../shared/ui/useVirtualList";
import { excludeScanCandidates, setScanCandidateRjCode, SCAN_QUERY_KEYS } from "../../../api";
import { restoreScanCandidateExclusions } from "../../../../../entities/scan/api";
import {
  refreshScanCandidates,
  replaceScanCandidate,
} from "../../../../../entities/scan/scanCandidatesCache";
import { useRegisterScanCandidatesMutation } from "../../../../../entities/work/model/workMutations";
import {
  scanCandidateDeselectedPathsAtom,
  scanCandidateHiddenPathsAtom,
} from "../../../../../entities/scan/model/atoms";
import { useDlsiteJobState, useDlsiteJobStore } from "../../../../../entities/dlsite/useDlsiteJob";
import { candidateDlsiteDisplay } from "../../../model/unregisteredDlsite";
import {
  fetchTargetCodes,
  isProblemDisplay,
  missingDlsiteCount,
  problemCount,
  registerTargets,
  type CandidateRowModel,
} from "../../../model/unregisteredSelection";
import type { CandidatesRegisteredResult } from "../types";
import DlsiteFetchSlot from "./DlsiteFetchSlot";
import UnregisteredFooter from "./UnregisteredFooter";
import UnregisteredListHeader from "./UnregisteredListHeader";
import UnregisteredRow, { type UnregisteredRowHandlers } from "./UnregisteredRow";
import UnregisteredToolbar from "./UnregisteredToolbar";
import type { RjCodeCommitResult, RjCodeFieldError } from "./RjCodeCell";
import { ROW_HEIGHT } from "./layout";

export interface UnregisteredTabProps {
  candidates: ScanCandidate[];
  onRegistered: (result: CandidatesRegisteredResult) => void;
}

const STALE_MESSAGE = "候補が更新されたため表示を更新しました。選び直してください。";

function isCandidatesStale(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 409;
}

export default function UnregisteredTab({ candidates, onRegistered }: UnregisteredTabProps) {
  const queryClient = useQueryClient();
  const jobStore = useDlsiteJobStore();
  const jobState = useDlsiteJobState((state) => state);
  const setHiddenPaths = useSetAtom(scanCandidateHiddenPathsAtom);
  const [deselectedPaths, setDeselectedPaths] = useAtom(scanCandidateDeselectedPathsAtom);
  const [fieldErrors, setFieldErrors] = useState<ReadonlyMap<string, RjCodeFieldError>>(
    () => new Map(),
  );
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const toast = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { job, settled } = jobStore.getState();
    if (job?.status !== "finished" || settled) return;
    void refreshScanCandidates(queryClient).then(
      () => jobStore.markSettled(job.jobId),
      () => {},
    );
  }, [jobStore, queryClient]);

  const allRows = useMemo<CandidateRowModel[]>(
    () =>
      candidates.map((candidate) => ({
        candidate,
        display: candidateDlsiteDisplay(candidate, jobState),
      })),
    [candidates, jobState],
  );
  const problems = problemCount(allRows);
  const filtering = onlyProblems && problems > 0;
  useEffect(() => {
    if (onlyProblems && problems === 0) setOnlyProblems(false);
  }, [onlyProblems, problems]);

  const visibleRows = useMemo(
    () => (filtering ? allRows.filter(({ display }) => isProblemDisplay(display)) : allRows),
    [allRows, filtering],
  );
  const selectedVisible = useMemo(
    () => visibleRows.filter(({ candidate }) => !deselectedPaths.has(candidate.path)),
    [visibleRows, deselectedPaths],
  );
  // 値を確定できていない行は、選択済みでも取得・追加の対象から外す。
  const operableRows = useMemo(
    () => selectedVisible.filter(({ candidate }) => !fieldErrors.has(candidate.path)),
    [selectedVisible, fieldErrors],
  );
  const fetchCodes = useMemo(() => fetchTargetCodes(operableRows), [operableRows]);
  const registerRows = useMemo(() => registerTargets(operableRows), [operableRows]);
  const missingCount = missingDlsiteCount(registerRows);

  const allSelected = visibleRows.length > 0 && selectedVisible.length === visibleRows.length;
  const partiallySelected = selectedVisible.length > 0 && !allSelected;

  const registerMutation = useRegisterScanCandidatesMutation();
  const register = async (apply: DlsiteRegistrationApply) => {
    const paths = registerRows.map(({ candidate }) => candidate.path);
    const outcome = await registerMutation.mutateAsync({ paths, apply });
    const { interruptedBy } = outcome;
    if (interruptedBy) {
      setErrorMessage(
        isCandidatesStale(interruptedBy)
          ? STALE_MESSAGE
          : apiErrorMessage(interruptedBy, "ライブラリへの追加に失敗しました"),
      );
    } else {
      setErrorMessage(
        outcome.failures.length > 0
          ? outcome.failures.map((failure) => failure.message).join("\n")
          : null,
      );
    }
    if (isCandidatesStale(interruptedBy)) await refreshScanCandidates(queryClient).catch(() => {});
    const registeredPaths = new Set(outcome.registered.map((entry) => entry.path));
    setHiddenPaths((previous) => new Set([...previous, ...registeredPaths]));
    if (registeredPaths.size === 0 && interruptedBy) return;
    onRegistered({
      registeredCount: outcome.registered.length,
      failedCount: outcome.failures.length,
      interrupted: interruptedBy !== null,
    });
  };

  const restoreMutation = useMutation({
    mutationFn: (paths: string[]) => restoreScanCandidateExclusions(paths),
    onSuccess: async (_void, paths) => {
      toast.dismiss();
      setHiddenPaths((previous) => {
        const next = new Set(previous);
        for (const path of paths) next.delete(path);
        return next;
      });
      await refreshScanCandidates(queryClient);
    },
    onError: (error) => setErrorMessage(apiErrorMessage(error, "取り消しに失敗しました")),
  });

  const excludeMutation = useMutation({
    mutationFn: (paths: string[]) => excludeScanCandidates(paths),
    onSuccess: async (_void, paths) => {
      setHiddenPaths((previous) => new Set([...previous, ...paths]));
      toast.show({
        message: `${paths.length}件を候補から外しました`,
        variant: "success",
        actionLabel: "元に戻す",
        onAction: () => restoreMutation.mutate(paths),
        priority: "action",
      });
      await queryClient.invalidateQueries({ queryKey: SCAN_QUERY_KEYS.candidateExclusions() });
    },
    onError: (error) => setErrorMessage(apiErrorMessage(error, "候補から外せませんでした")),
  });

  const rjCodeMutation = useMutation({
    mutationFn: ({ path, rjCode }: { path: ScanCandidate["path"]; rjCode: string }) =>
      setScanCandidateRjCode(path, rjCode),
    onSuccess: (candidate) => {
      replaceScanCandidate(queryClient, candidate);
      clearFieldError(candidate.path);
      setEditingPath(null);
      setErrorMessage(null);
    },
    onError: async (error) => {
      setErrorMessage(
        isCandidatesStale(error)
          ? STALE_MESSAGE
          : apiErrorMessage(error, "RJコードを直せませんでした"),
      );
      setEditingPath(null);
      if (isCandidatesStale(error)) await refreshScanCandidates(queryClient).catch(() => {});
    },
  });

  const busy = registerMutation.isPending || excludeMutation.isPending || restoreMutation.isPending;

  const clearFieldError = (path: string) => {
    setFieldErrors((previous) => {
      if (!previous.has(path)) return previous;
      const next = new Map(previous);
      next.delete(path);
      return next;
    });
  };

  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;
  const rjCodePendingRef = useRef(false);
  rjCodePendingRef.current = rjCodeMutation.isPending;
  const mutateRjCode = rjCodeMutation.mutate;

  const commitEdit = useCallback(
    (path: string, rawValue: string): RjCodeCommitResult => {
      if (rjCodePendingRef.current) return "done";
      const candidate = candidatesRef.current.find((entry) => entry.path === path);
      if (!candidate) {
        setEditingPath(null);
        return "done";
      }
      const trimmed = rawValue.trim();
      if (trimmed === "") {
        if (candidate.rjCode === null) {
          clearFieldError(path);
          setEditingPath(null);
        } else {
          mutateRjCode({ path: candidate.path, rjCode: "" });
        }
        return "done";
      }
      const parsed = rjCodeFormatSchema.safeParse(trimmed);
      if (!parsed.success) {
        setFieldErrors((previous) =>
          new Map(previous).set(path, {
            value: rawValue,
            message: parsed.error.issues[0]?.message ?? "RJ/VJコードの形式が正しくありません",
          }),
        );
        return "invalid";
      }
      if (parsed.data === candidate.rjCode) {
        clearFieldError(path);
        setEditingPath(null);
        return "done";
      }
      mutateRjCode({ path: candidate.path, rjCode: parsed.data });
      return "done";
    },
    [mutateRjCode],
  );

  const startEdit = useCallback((path: string) => setEditingPath(path), []);
  const cancelEdit = useCallback((path: string) => {
    clearFieldError(path);
    setEditingPath(null);
  }, []);
  const toggleRow = useCallback(
    (path: string) =>
      setDeselectedPaths((previous) => {
        const next = new Set(previous);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      }),
    [setDeselectedPaths],
  );

  const startSingle = useCallback(
    async (rjCode: string) => {
      const result = await jobStore.startSingle(rjCode);
      setErrorMessage(result.ok ? null : result.error);
    },
    [jobStore],
  );

  const handlers = useMemo<UnregisteredRowHandlers>(
    () => ({
      onToggle: toggleRow,
      onStartEdit: startEdit,
      onCommitEdit: commitEdit,
      onCancelEdit: cancelEdit,
      onFetchSingle: (rjCode) => void startSingle(rjCode),
    }),
    [toggleRow, startEdit, commitEdit, cancelEdit, startSingle],
  );

  const toggleAll = () =>
    setDeselectedPaths((previous) => {
      const next = new Set(previous);
      for (const { candidate } of visibleRows) {
        if (allSelected) next.add(candidate.path);
        else next.delete(candidate.path);
      }
      return next;
    });

  const startBulk = async () => {
    const result = await jobStore.startBulk(fetchCodes);
    setErrorMessage(result.ok ? null : result.error);
  };

  const { virtualItems, wrapperStyle, getItemStyle } = useVirtualList({
    count: visibleRows.length,
    estimateSize: ROW_HEIGHT,
    scrollRef,
    resetKey: String(filtering),
    resetScrollTop: true,
  });

  if (candidates.length === 0) {
    return (
      <p className="px-[18px] py-4 font-jp text-body text-ink-2">未登録の候補はありません。</p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <UnregisteredToolbar
        allSelected={allSelected}
        partiallySelected={partiallySelected}
        selectAllDisabled={visibleRows.length === 0}
        onToggleAll={toggleAll}
        excludeCount={selectedVisible.length}
        busy={busy}
        onExclude={() =>
          excludeMutation.mutate(selectedVisible.map(({ candidate }) => candidate.path))
        }
        problemCount={problems}
        onlyProblems={filtering}
        onToggleOnlyProblems={() => setOnlyProblems((value) => !value)}
        slot={
          <DlsiteFetchSlot
            targetCount={fetchCodes.length}
            busy={busy}
            onStart={() => void startBulk()}
            onCancel={() => void jobStore.cancelBulk()}
          />
        }
      />
      <section aria-label="未登録の候補" className="flex min-h-0 flex-1 flex-col">
        <div
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 仮想リストは行を絶対配置するため table 要素にできず、role=table で ARIA table 構造を与える
          role="table"
          aria-label="未登録の候補一覧"
          aria-rowcount={visibleRows.length + 1}
          className="flex min-h-0 flex-1 flex-col"
        >
          <UnregisteredListHeader />
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 仮想リストの行群は tbody にできないため role=rowgroup で与える
              role="rowgroup"
              style={wrapperStyle}
            >
              {virtualItems.map((virtualRow) => {
                const row = visibleRows[virtualRow.index];
                if (!row) return null;
                const { candidate, display } = row;
                return (
                  <div
                    key={candidate.path}
                    style={{ ...getItemStyle(virtualRow), height: ROW_HEIGHT }}
                  >
                    <UnregisteredRow
                      candidate={candidate}
                      display={display}
                      selected={!deselectedPaths.has(candidate.path)}
                      editing={editingPath === candidate.path}
                      error={fieldErrors.get(candidate.path)}
                      busy={busy}
                      handlers={handlers}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      {errorMessage && (
        <p
          role="alert"
          className="shrink-0 whitespace-pre-line border-t border-line-soft px-[18px] py-2 font-jp text-secondary text-[var(--state-danger)]"
        >
          {errorMessage}
        </p>
      )}
      <UnregisteredFooter
        registerCount={registerRows.length}
        missingDlsiteCount={missingCount}
        busy={busy}
        onRegister={(apply) => void register(apply)}
      />
    </div>
  );
}
