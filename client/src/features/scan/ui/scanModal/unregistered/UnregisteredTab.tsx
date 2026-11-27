import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import {
  type WorkspacePath,
  type DlsiteRegistrationApply,
  type ScanCandidate,
} from "@mimimilli/shared";
import { apiErrorMessage } from "../../../../../shared/lib/apiError";
import { isFocusLost } from "../../../../../shared/lib/isFocusLost";
import { useLatest } from "../../../../../shared/lib/useLatest";
import { useVirtualList } from "../../../../../shared/ui/useVirtualList";
import { isCandidatesStale, STALE_MESSAGE } from "../../../model/candidatesStale";
import { useCandidateExclusions } from "../../../model/useCandidateExclusions";
import { useScanCandidatesState } from "../../../model/useScanCandidatesCache";
import { refreshScanCandidatesQuietly } from "../../../../../entities/scan/scanCandidatesCache";
import { useRegisterScanCandidatesMutation } from "../../../../../entities/work/model/workMutations";
import { scanCandidateSelectionAtom } from "../../../../../entities/scan/model/atoms";
import { useDlsiteJobState, useDlsiteJobStore } from "../../../../../entities/dlsite/useDlsiteJob";
import { candidateDlsiteDisplay, dlsiteResultRevision } from "../../../model/unregisteredDlsite";
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
import { deriveScanListStatus } from "../../../model/scanListStatus";
import ScanListState from "../ScanListState";
import { useDisplayedScanListStatus } from "../useDisplayedScanListStatus";
import type { CandidatesRegisteredResult } from "../types";
import ExcludedList from "./ExcludedList";
import UnregisteredFooter from "./UnregisteredFooter";
import UnregisteredListHeader from "./UnregisteredListHeader";
import UnregisteredRow, { type UnregisteredRowHandlers } from "./UnregisteredRow";
import UnregisteredToolbar from "./UnregisteredToolbar";
import { useRjCodeEditing } from "./useRjCodeEditing";
import { ROW_HEIGHT } from "./layout";

export interface UnregisteredTabProps {
  onRegistered: (result: CandidatesRegisteredResult) => void;
  onOpenFiles: (path: WorkspacePath) => void;
}

interface RowFilter {
  kind: "problem" | "noinfo";
  paths: ReadonlySet<string>;
}

const pathsOf = (rows: readonly CandidateRowModel[]) =>
  new Set(rows.map(({ candidate }) => candidate.path));

interface FocusRequest {
  nextPath: string | null;
  gone: ReadonlySet<string>;
}

/** 消える行のあとに残る、次（無ければ前）の行の path */
function nextRowPathAfterLeaving(
  visibleRows: readonly CandidateRowModel[],
  leaving: readonly CandidateRowModel[],
): string | null {
  const gone = pathsOf(leaving);
  const firstGone = visibleRows.findIndex(({ candidate }) => gone.has(candidate.path));
  const survivor = (rows: readonly CandidateRowModel[]) =>
    rows.find(({ candidate }) => !gone.has(candidate.path));
  const next =
    survivor(visibleRows.slice(firstGone + 1)) ??
    survivor(visibleRows.slice(0, firstGone).reverse());
  return next?.candidate.path ?? null;
}

function focusRequestFor(
  visibleRows: readonly CandidateRowModel[],
  leaving: readonly CandidateRowModel[],
): FocusRequest {
  return { nextPath: nextRowPathAfterLeaving(visibleRows, leaving), gone: pathsOf(leaving) };
}

export default function UnregisteredTab({ onRegistered, onOpenFiles }: UnregisteredTabProps) {
  const queryClient = useQueryClient();
  const candidatesState = useScanCandidatesState();
  const { candidates } = candidatesState;
  const status = useDisplayedScanListStatus(
    deriveScanListStatus({
      loading: candidatesState.status === "loading",
      error: candidatesState.status === "error",
      notScanned: !candidatesState.scanCompleted,
      count: candidates.length,
    }),
  );
  const retryCandidates = () => void refreshScanCandidatesQuietly(queryClient);
  const jobStore = useDlsiteJobStore();
  const jobState = useDlsiteJobState((state) => state);
  const [selection, setSelection] = useAtom(scanCandidateSelectionAtom);
  const [filter, setFilter] = useState<RowFilter | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { editingPath, fieldErrors, savingPath, startEdit, commitEdit, cancelEdit } =
    useRjCodeEditing({ candidates, onMessage: setErrorMessage });

  const allRows = useMemo<CandidateRowModel[]>(
    () =>
      candidates.map((candidate) => ({
        candidate,
        display: candidateDlsiteDisplay(candidate, jobState),
        resultRevision: dlsiteResultRevision(candidate, jobState),
        invalidRj: fieldErrors.has(candidate.path),
      })),
    [candidates, jobState, fieldErrors],
  );
  const allRowsRef = useLatest(allRows);
  const problems = judgmentCount(allRows);

  const filteredRows = useMemo(
    () => (filter ? allRows.filter(({ candidate }) => filter.paths.has(candidate.path)) : allRows),
    [allRows, filter],
  );
  // 固定した行がすべて無くなった絞り込みは、件数が戻っても復活しないよう state ごと解除する
  const filterGone = filter !== null && filteredRows.length === 0;
  if (filterGone) setFilter(null);
  const activeFilter = filterGone ? null : filter;
  const visibleRows = activeFilter ? filteredRows : allRows;
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
    status: exclusionsStatus,
    retry: retryExclusions,
    exclude,
    excluding,
    restore: restoreExclusions,
  } = useCandidateExclusions({ onExcludeError: setErrorMessage });
  const panelRef = useRef<HTMLDivElement>(null);
  const excludedTriggerRef = useRef<HTMLButtonElement>(null);
  const closeExcluded = () => {
    flushSync(() => setShowExcluded(false));
    (excludedTriggerRef.current ?? panelRef.current)?.focus();
  };

  const registerMutation = useRegisterScanCandidatesMutation();
  const busy = registerMutation.isPending || excluding;
  const register = async (apply: DlsiteRegistrationApply) => {
    if (busy) return;
    const paths = registerRows.map(({ candidate }) => candidate.path);
    const titleByPath = new Map(
      registerRows.map((row) => [
        row.candidate.path,
        apply.title ? rowTitle(row) : row.candidate.inferredTitle,
      ]),
    );
    const titlesOf = (entries: readonly { path: ScanCandidate["path"] }[]) =>
      entries.map((entry) => titleByPath.get(entry.path) ?? entry.path);
    focusRequestRef.current = focusRequestFor(visibleRows, registerRows);
    let outcome;
    try {
      outcome = await registerMutation.mutateAsync({ paths, apply });
    } catch (error) {
      focusRequestRef.current = null;
      throw error;
    }
    // 追加できた行だけが消える
    narrowFocusRequest(outcome.registered.map((entry) => entry.path));
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
    if (isCandidatesStale(interruptedBy)) await refreshScanCandidatesQuietly(queryClient);
    onRegistered({
      registeredTitles: titlesOf(outcome.registered),
      coverSkippedTitles: titlesOf(
        outcome.registered.filter((entry) => entry.coverSkipped !== null),
      ),
      failedCount: outcome.failures.length,
      remainingCandidates: outcome.refreshedCandidates?.candidates.length ?? null,
      interrupted: interruptedBy !== null,
    });
  };

  // 行が消える操作（除外・追加）のあと、操作した要素（行の︙・フッターの▾・主ボタン）が消えるか無効になる。
  // 操作の前に移し先（残った隣の行の︙、次→前の順。無ければパネル）を決め、行が消えたコミットで移す
  const focusRequestRef = useRef<FocusRequest | null>(null);
  const [focusRequestTick, setFocusRequestTick] = useState(0);
  const narrowFocusRequest = (gonePaths: readonly string[]) => {
    const request = focusRequestRef.current;
    if (!request) return;
    focusRequestRef.current =
      gonePaths.length === 0 ? null : { ...request, gone: new Set(gonePaths) };
    setFocusRequestTick((tick) => tick + 1);
  };
  useLayoutEffect(() => {
    const request = focusRequestRef.current;
    if (
      !request ||
      request.gone.size === 0 ||
      allRows.some(({ candidate }) => request.gone.has(candidate.path))
    ) {
      return;
    }
    focusRequestRef.current = null;
    // 起点（フッターの▾や主ボタン）が残ってフォーカスもそこにあるとき、ユーザーが他へ移したときは動かさない
    if (!isFocusLost()) return;
    const row = [
      ...(scrollRef.current?.querySelectorAll<HTMLElement>("[data-candidate-path]") ?? []),
    ].find((element) => element.dataset.candidatePath === request.nextPath);
    const target = row?.querySelector<HTMLElement>("[data-row-menu]");
    (target ?? panelRef.current)?.focus({ preventScroll: true });
  }, [focusRequestTick, allRows]);

  const excludeRows = useCallback(
    (rows: readonly CandidateRowModel[]) => {
      if (rows.length === 0) return;
      setErrorMessage(null);
      if (busy) return;
      focusRequestRef.current = focusRequestFor(visibleRows, rows);
      exclude(
        {
          paths: rows.map(({ candidate }) => candidate.path),
          titles: rows.map(rowTitle),
        },
        { onError: () => (focusRequestRef.current = null) },
      );
    },
    [exclude, visibleRows, busy],
  );

  const toggleRow = useCallback(
    (path: string) =>
      setSelection((previous) => {
        const row = allRowsRef.current.find(({ candidate }) => candidate.path === path);
        if (!row) return previous;
        return new Map(previous).set(path, selectionOverride(row, !isRowSelected(row, previous)));
      }),
    [setSelection, allRowsRef],
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
    [toggleRow, startEdit, commitEdit, cancelEdit, excludeRows, onOpenFiles, allRowsRef],
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
    resetKey: activeFilter?.kind ?? "",
    resetScrollTop: true,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showExcluded && (
        <ExcludedList
          exclusions={exclusions}
          status={exclusionsStatus}
          onRetry={retryExclusions}
          onBack={closeExcluded}
          onRestore={(path) => restoreExclusions([path])}
        />
      )}
      <div
        ref={panelRef}
        tabIndex={-1}
        inert={showExcluded}
        className={showExcluded ? "hidden" : "flex min-h-0 flex-1 flex-col outline-none"}
      >
        <UnregisteredToolbar
          excludedCount={exclusions.length}
          excludedFailed={exclusionsStatus === "error"}
          excludedTriggerRef={excludedTriggerRef}
          onShowExcluded={() => setShowExcluded(true)}
          problemCount={problems}
          filter={activeFilter && { kind: activeFilter.kind, count: visibleRows.length }}
          onFilterProblems={() =>
            setFilter({ kind: "problem", paths: pathsOf(allRows.filter(needsJudgment)) })
          }
          onClearFilter={() => setFilter(null)}
        />
        <ScanListState
          status={status}
          emptyMessage="未登録の候補はありません"
          onRetry={retryCandidates}
          table={{ label: "未登録の候補一覧", rowCount: visibleRows.length + 1 }}
          heading={
            <UnregisteredListHeader
              allSelected={allSelected}
              partiallySelected={partiallySelected}
              selectAllDisabled={busy || selectableCount === 0}
              onToggleAll={toggleAll}
            />
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
                    data-candidate-path={candidate.path}
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
                      rjCodeLocked={savingPath !== null && savingPath !== candidate.path}
                      rjCodeSaving={savingPath === candidate.path}
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
              rjCodeSaving={savingPath !== null}
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
