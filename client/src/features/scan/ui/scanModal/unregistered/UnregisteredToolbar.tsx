import { useEffect, useRef } from "react";
import Button from "../../../../../shared/ui/Button";

interface UnregisteredToolbarProps {
  allSelected: boolean;
  partiallySelected: boolean;
  selectAllDisabled: boolean;
  onToggleAll: () => void;
  excludeCount: number;
  busy: boolean;
  onExclude: () => void;
  /** 問題のある候補の件数。0かつ絞り込み中でないときはリンクを出さない */
  problemCount: number;
  onlyProblems: boolean;
  onToggleOnlyProblems: () => void;
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
  onlyProblems,
  onToggleOnlyProblems,
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
        {(problemCount > 0 || onlyProblems) && (
          <button
            type="button"
            onClick={onToggleOnlyProblems}
            className="font-jp text-secondary text-acc-ink underline underline-offset-2 hover:text-ink-0"
          >
            {onlyProblems ? "すべて表示" : `問題のある${problemCount}件だけ表示`}
          </button>
        )}
      </div>
    </div>
  );
}
