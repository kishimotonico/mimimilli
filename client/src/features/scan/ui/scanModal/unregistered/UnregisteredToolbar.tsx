import Button from "../../../../../shared/ui/Button";
import { I } from "../../../../../shared/ui/Icon";
import ScanFilterChip from "../ScanFilterChip";

interface UnregisteredToolbarProps {
  excludedCount: number;
  onShowExcluded: () => void;
  /** 判断が要る候補の件数。0かつ絞り込み中でないときは出さない */
  problemCount: number;
  /** 押した時点の行で固定した絞り込み。null は絞り込みなし */
  filter: { kind: "problem" | "noinfo"; count: number } | null;
  onFilterProblems: () => void;
  onClearFilter: () => void;
}

type ToolbarContentInput = Pick<
  UnregisteredToolbarProps,
  "excludedCount" | "problemCount" | "filter"
>;

/** 帯に載せるものがあるか。無ければ帯ごと出さない */
export function hasUnregisteredToolbarContent({
  excludedCount,
  problemCount,
  filter,
}: ToolbarContentInput): boolean {
  return problemCount > 0 || filter !== null || excludedCount > 0;
}

export default function UnregisteredToolbar({
  excludedCount,
  onShowExcluded,
  problemCount,
  filter,
  onFilterProblems,
  onClearFilter,
}: UnregisteredToolbarProps) {
  if (!hasUnregisteredToolbarContent({ excludedCount, problemCount, filter })) return null;
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
      {excludedCount > 0 && (
        <Button
          variant="quiet"
          className="ml-auto px-2 font-normal"
          data-excluded-trigger
          onClick={onShowExcluded}
        >
          除外済み <span className="font-mono tabular-nums">{excludedCount}</span>
        </Button>
      )}
    </div>
  );
}

const PROBLEM_ICON = <I.err size={13} className="text-[var(--state-danger)]" aria-hidden="true" />;
