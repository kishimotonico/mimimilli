import type { Ref } from "react";
import Button from "../../../../../shared/ui/Button";
import { I } from "../../../../../shared/ui/Icon";
import ScanFilterChip from "../ScanFilterChip";

interface UnregisteredToolbarProps {
  /** 除外済みの件数。0かつ取得失敗でもないときは入口を出さない */
  excludedCount: number;
  /** 除外済みを読めなかった。0件と区別して入口を出し、一覧の中で再試行できるようにする */
  excludedFailed: boolean;
  excludedTriggerRef: Ref<HTMLButtonElement>;
  onShowExcluded: () => void;
  /** 判断が要る候補の件数。0かつ絞り込み中でないときは出さない */
  problemCount: number;
  /** 押した時点の行で固定した絞り込み。null は絞り込みなし */
  filter: { kind: "problem" | "noinfo"; count: number } | null;
  onFilterProblems: () => void;
  onClearFilter: () => void;
}

export default function UnregisteredToolbar({
  excludedCount,
  excludedFailed,
  excludedTriggerRef,
  onShowExcluded,
  problemCount,
  filter,
  onFilterProblems,
  onClearFilter,
}: UnregisteredToolbarProps) {
  const hasExcluded = excludedCount > 0 || excludedFailed;
  if (problemCount === 0 && filter === null && !hasExcluded) return null;
  return (
    <div
      data-testid="unregistered-toolbar"
      className="flex h-[46px] shrink-0 items-center gap-2.5 px-[18px]"
    >
      {filter?.kind === "noinfo" ? (
        <ScanFilterChip pressed clearable count={filter.count} onClick={onClearFilter}>
          DLsite情報なし
        </ScanFilterChip>
      ) : filter?.kind === "problem" ? (
        <ScanFilterChip
          pressed
          clearable
          count={filter.count}
          icon={PROBLEM_ICON}
          onClick={onClearFilter}
        >
          問題あり
        </ScanFilterChip>
      ) : (
        problemCount > 0 && (
          <ScanFilterChip
            pressed={false}
            count={problemCount}
            icon={PROBLEM_ICON}
            onClick={onFilterProblems}
          >
            問題あり
          </ScanFilterChip>
        )
      )}
      {hasExcluded && (
        <Button
          ref={excludedTriggerRef}
          variant="quiet"
          className="ml-auto px-2 font-normal"
          onClick={onShowExcluded}
        >
          除外済み{" "}
          {!excludedFailed && <span className="font-mono tabular-nums">{excludedCount}</span>}
        </Button>
      )}
    </div>
  );
}

const PROBLEM_ICON = <I.err size={13} className="text-[var(--state-danger)]" aria-hidden="true" />;
