import { useEffect, useRef } from "react";
import Button from "../../../../../shared/ui/Button";
import { cn } from "../../../../../shared/lib/cn";
import { I } from "../../../../../shared/ui/Icon";

interface UnregisteredToolbarProps {
  allSelected: boolean;
  partiallySelected: boolean;
  selectAllDisabled: boolean;
  onToggleAll: () => void;
  excludeCount: number;
  busy: boolean;
  onExclude: () => void;
  /** 判断が要る候補の件数。0かつ絞り込み中でないときは出さない */
  problemCount: number;
  /** 押した時点の行で固定した絞り込み。null は絞り込みなし */
  filter: { kind: "problem" | "noinfo"; count: number } | null;
  onFilterProblems: () => void;
  onClearFilter: () => void;
}

export default function UnregisteredToolbar({
  allSelected,
  partiallySelected,
  selectAllDisabled,
  onToggleAll,
  excludeCount,
  busy,
  onExclude,
  problemCount,
  filter,
  onFilterProblems,
  onClearFilter,
}: UnregisteredToolbarProps) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-line-soft px-[18px] py-2">
      <div className="flex min-w-0 items-center gap-3">
        <label className="flex items-center gap-2 font-jp text-body text-ink-1">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={allSelected}
            disabled={busy || selectAllDisabled}
            onChange={onToggleAll}
          />
          すべて選択
        </label>
        <Button variant="quiet" disabled={busy || excludeCount === 0} onClick={onExclude}>
          除外
        </Button>
        {filter?.kind === "noinfo" ? (
          <FilterChip pressed count={filter.count} onClick={onClearFilter}>
            DLsite情報なし
          </FilterChip>
        ) : filter?.kind === "problem" ? (
          <FilterChip pressed count={filter.count} icon={PROBLEM_ICON} onClick={onClearFilter}>
            問題あり
          </FilterChip>
        ) : (
          problemCount > 0 && (
            <FilterChip
              pressed={false}
              count={problemCount}
              icon={PROBLEM_ICON}
              onClick={onFilterProblems}
            >
              問題あり
            </FilterChip>
          )
        )}
      </div>
    </div>
  );
}

const PROBLEM_ICON = <I.err size={13} className="text-[var(--state-danger)]" aria-hidden="true" />;

function FilterChip({
  pressed,
  count,
  icon,
  onClick,
  children,
}: {
  pressed: boolean;
  icon?: React.ReactNode;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 font-jp text-control",
        pressed
          ? "border-transparent bg-acc-soft font-medium text-acc-ink"
          : "border-line bg-paper-1 text-ink-1 hover:bg-paper-2",
      )}
    >
      {icon}
      {children}
      <span className="font-mono tabular-nums">{count}</span>
      {pressed && <I.x size={12} />}
    </button>
  );
}
