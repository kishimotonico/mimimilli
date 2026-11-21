import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  rjCodeFormatSchema,
  type WorkspacePath,
  type DlsiteRegistrationApply,
  type ScanCandidate,
} from "@mimimilli/shared";
import { apiErrorMessage } from "../../../../../shared/lib/apiError";
import { useVirtualList } from "../../../../../shared/ui/useVirtualList";
import { setScanCandidateRjCode } from "../../../api";
import { isCandidatesStale, STALE_MESSAGE } from "../../../model/candidatesStale";
import { useCandidateExclusions } from "../../../model/useCandidateExclusions";
import { refreshScanCandidates } from "../../../../../entities/scan/scanCandidatesCache";
import { useRegisterScanCandidatesMutation } from "../../../../../entities/work/model/workMutations";
import { scanCandidateSelectionAtom } from "../../../../../entities/scan/model/atoms";
import { useDlsiteJobState, useDlsiteJobStore } from "../../../../../entities/dlsite/useDlsiteJob";
import { candidateDlsiteDisplay } from "../../../model/unregisteredDlsite";
import {
  addTargets,
  footerPlan,
  isRowSelectable,
  isRowSelected,
  judgmentCount,
  missingDlsiteRows,
  needsJudgment,
  rowTitle,
  selectionOverride,
  type CandidateRowModel,
} from "../../../model/unregisteredSelection";
import type { ScanListStatus } from "../../../model/scanListStatus";
import ScanListState from "../ScanListState";
import { useDisplayedScanListStatus } from "../useDisplayedScanListStatus";
import type { CandidatesRegisteredResult } from "../types";
import ExcludedList from "./ExcludedList";
import UnregisteredFooter from "./UnregisteredFooter";
import UnregisteredListHeader from "./UnregisteredListHeader";
import UnregisteredRow, { type UnregisteredRowHandlers } from "./UnregisteredRow";
import UnregisteredToolbar, { hasUnregisteredToolbarContent } from "./UnregisteredToolbar";
import type { RjCodeCommitResult, RjCodeFieldError } from "./RjCodeCell";
import { ROW_HEIGHT } from "./layout";

export interface UnregisteredTabProps {
  candidates: ScanCandidate[];
  status: ScanListStatus;
  onRetry: () => void;
  onRegistered: (result: CandidatesRegisteredResult) => void;
  onOpenFiles: (path: WorkspacePath) => void;
}

interface RowFilter {
  kind: "problem" | "noinfo";
  paths: ReadonlySet<string>;
}

const pathsOf = (rows: readonly CandidateRowModel[]) =>
  new Set(rows.map(({ candidate }) => candidate.path));

const RJ_CODE_FORMAT_REASON = "RJ/VJ＋6〜8桁の数字";

export default function UnregisteredTab({
  candidates,
  status: rawStatus,
  onRetry,
  onRegistered,
  onOpenFiles,
}: UnregisteredTabProps) {
  const status = useDisplayedScanListStatus(rawStatus);
  const queryClient = useQueryClient();
  const jobStore = useDlsiteJobStore();
  const jobState = useDlsiteJobState((state) => state);
  const [selection, setSelection] = useAtom(scanCandidateSelectionAtom);
  const [fieldErrors, setFieldErrors] = useState<ReadonlyMap<string, RjCodeFieldError>>(
    () => new Map(),
  );
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [filter, setFilter] = useState<RowFilter | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allRows = useMemo<CandidateRowModel[]>(
    () =>
      candidates.map((candidate) => ({
        candidate,
        display: candidateDlsiteDisplay(candidate, jobState),
        invalidRj: fieldErrors.has(candidate.path),
      })),
    [candidates, jobState, fieldErrors],
  );
  const problems = judgmentCount(allRows);

  const visibleRows = useMemo(
    () => (filter ? allRows.filter(({ candidate }) => filter.paths.has(candidate.path)) : allRows),
    [allRows, filter],
  );
  useEffect(() => {
    if (filter && visibleRows.length === 0) setFilter(null);
  }, [filter, visibleRows.length]);
  const selectedVisible = useMemo(
    () => visibleRows.filter((row) => isRowSelected(row, selection)),
    [visibleRows, selection],
  );
  const plan = useMemo(() => footerPlan(selectedVisible), [selectedVisible]);
  const registerRows = useMemo(() => addTargets(selectedVisible), [selectedVisible]);
  const noDlsiteRows = useMemo(() => missingDlsiteRows(registerRows), [registerRows]);

  const selectableCount = useMemo(() => visibleRows.filter(isRowSelectable).length, [visibleRows]);
  const allSelected = selectableCount > 0 && selectedVisible.length === selectableCount;
  const partiallySelected = selectedVisible.length > 0 && !allSelected;

  const {
    exclusions,
    exclude,
    excluding,
    restore: restoreExclusions,
  } = useCandidateExclusions({ onExcludeError: setErrorMessage });
  const panelRef = useRef<HTMLDivElement>(null);
  const refocusPanelRef = useRef(false);
  const closeExcluded = () => {
    refocusPanelRef.current = true;
    setShowExcluded(false);
  };
  useEffect(() => {
    if (showExcluded || !refocusPanelRef.current) return;
    refocusPanelRef.current = false;
    const panel = panelRef.current;
    const target =
      panel?.querySelector<HTMLElement>("[data-excluded-trigger]") ??
      panel?.querySelector<HTMLElement>("[data-select-all]:not(:disabled)") ??
      panel?.querySelector<HTMLElement>("input:not(:disabled), button:not(:disabled)");
    target?.focus();
  }, [showExcluded]);

  const registerMutation = useRegisterScanCandidatesMutation();
  const register = async (apply: DlsiteRegistrationApply) => {
    const paths = registerRows.map(({ candidate }) => candidate.path);
    const titleByPath = new Map(
      registerRows.map((row) => [
        row.candidate.path,
        apply.title ? rowTitle(row) : row.candidate.inferredTitle,
      ]),
    );
    const titlesOf = (entries: readonly { path: ScanCandidate["path"] }[]) =>
      entries.map((entry) => titleByPath.get(entry.path) ?? entry.path);
    const remainingBefore = candidates.length;
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
    onRegistered({
      registeredTitles: titlesOf(outcome.registered),
      coverSkippedTitles: titlesOf(
        outcome.registered.filter((entry) => entry.coverSkipped !== null),
      ),
      failedCount: outcome.failures.length,
      remainingCount: remainingBefore - outcome.registered.length,
      interrupted: interruptedBy !== null,
    });
  };

  const rjCodeMutation = useMutation({
    mutationFn: ({ path, rjCode }: { path: ScanCandidate["path"]; rjCode: string }) =>
      setScanCandidateRjCode(path, rjCode),
    onSuccess: (candidate) => {
      void refreshScanCandidates(queryClient, { replace: candidate }).catch(() => {});
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

  const busy = registerMutation.isPending || excluding;

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

  const excludeRows = useCallback(
    (rows: readonly CandidateRowModel[]) => {
      if (rows.length === 0) return;
      setErrorMessage(null);
      exclude({
        paths: rows.map(({ candidate }) => candidate.path),
        titles: rows.map(rowTitle),
      });
    },
    [exclude],
  );

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
            message: RJ_CODE_FORMAT_REASON,
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
  const allRowsRef = useRef(allRows);
  useEffect(() => {
    allRowsRef.current = allRows;
  }, [allRows]);
  const toggleRow = useCallback(
    (path: string) =>
      setSelection((previous) => {
        const row = allRowsRef.current.find(({ candidate }) => candidate.path === path);
        if (!row) return previous;
        return new Map(previous).set(path, selectionOverride(row, !isRowSelected(row, previous)));
      }),
    [setSelection],
  );

  const handlers = useMemo<UnregisteredRowHandlers>(
    () => ({
      onToggle: toggleRow,
      onStartEdit: startEdit,
      onCommitEdit: commitEdit,
      onCancelEdit: cancelEdit,
      onOpenFolder: onOpenFiles,
      onExclude: (path) =>
        excludeRows(allRowsRef.current.filter((row) => row.candidate.path === path)),
    }),
    [toggleRow, startEdit, commitEdit, cancelEdit, excludeRows, onOpenFiles],
  );

  const toggleAll = () =>
    setSelection((previous) => {
      const next = new Map(previous);
      for (const row of visibleRows) {
        if (!isRowSelectable(row)) continue;
        next.set(row.candidate.path, selectionOverride(row, !allSelected));
      }
      return next;
    });

  const startFetch = async () => {
    if (plan.kind !== "fetch") return;
    const result = await jobStore.start(plan.codes, plan.force);
    setErrorMessage(result.ok ? null : result.error);
  };

  const excludeSelected = () => excludeRows(selectedVisible);

  const { virtualItems, wrapperStyle, getItemStyle } = useVirtualList({
    count: visibleRows.length,
    estimateSize: ROW_HEIGHT,
    scrollRef,
    resetKey: filter?.kind ?? "",
    resetScrollTop: true,
  });

  const toolbarFilter = filter && { kind: filter.kind, count: visibleRows.length };
  const toolbar = (
    <UnregisteredToolbar
      excludedCount={exclusions.length}
      onShowExcluded={() => setShowExcluded(true)}
      problemCount={problems}
      filter={toolbarFilter}
      onFilterProblems={() =>
        setFilter({ kind: "problem", paths: pathsOf(allRows.filter(needsJudgment)) })
      }
      onClearFilter={() => setFilter(null)}
    />
  );
  const toolbarOutside =
    status !== "loading" &&
    status !== "ready" &&
    hasUnregisteredToolbarContent({
      excludedCount: exclusions.length,
      problemCount: problems,
      filter: toolbarFilter,
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showExcluded && (
        <ExcludedList
          paths={exclusions}
          onBack={closeExcluded}
          onRestore={(path) => restoreExclusions([path])}
        />
      )}
      <div
        ref={panelRef}
        inert={showExcluded}
        className={showExcluded ? "hidden" : "flex min-h-0 flex-1 flex-col"}
      >
        {toolbarOutside && toolbar}
        <ScanListState
          status={status}
          emptyMessage="未登録の候補はありません"
          onRetry={onRetry}
          table={{ label: "未登録の候補一覧", rowCount: visibleRows.length + 1 }}
          heading={
            <>
              {toolbar}
              <UnregisteredListHeader
                allSelected={allSelected}
                partiallySelected={partiallySelected}
                selectAllDisabled={busy || selectableCount === 0}
                onToggleAll={toggleAll}
              />
            </>
          }
        >
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
                      flagged={needsJudgment(row)}
                      selected={isRowSelected(row, selection)}
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
        </ScanListState>
        {status === "ready" && (
          <>
            {errorMessage && (
              <p
                role="alert"
                className="shrink-0 whitespace-pre-line border-t border-line-soft px-[18px] py-2 font-jp text-secondary text-[var(--state-danger)]"
              >
                {errorMessage}
              </p>
            )}
            <UnregisteredFooter
              plan={plan}
              selectedCount={selectedVisible.length}
              addCount={registerRows.length}
              missingDlsiteCount={noDlsiteRows.length}
              onFilterMissingDlsite={() =>
                setFilter({ kind: "noinfo", paths: pathsOf(noDlsiteRows) })
              }
              busy={busy}
              onFetch={() => void startFetch()}
              onCancelFetch={() => void jobStore.cancel()}
              onRegister={(apply) => void register(apply)}
              onExclude={excludeSelected}
            />
          </>
        )}
      </div>
    </div>
  );
}
