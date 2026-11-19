import type { WorkChangeKind } from "@mimimilli/shared";
import { cn } from "../../../../../shared/lib/cn";
import {
  WORK_CHANGE_KIND_ICON,
  WORK_CHANGE_KIND_LABEL,
  WORK_CHANGE_KIND_ORDER,
} from "../../../model/describeWorkChange";

interface ChangeKindFilterProps {
  value: WorkChangeKind | null;
  total: number;
  counts: Record<WorkChangeKind, number>;
  onChange: (kind: WorkChangeKind | null) => void;
}

export default function ChangeKindFilter({
  value,
  total,
  counts,
  onChange,
}: ChangeKindFilterProps) {
  return (
    <div className="flex shrink-0 items-center gap-4 border-b border-line-soft px-[18px]">
      <FilterButton selected={value === null} count={total} onClick={() => onChange(null)}>
        すべて
      </FilterButton>
      {WORK_CHANGE_KIND_ORDER.map((kind) => {
        const Icon = WORK_CHANGE_KIND_ICON[kind];
        return (
          <FilterButton
            key={kind}
            selected={value === kind}
            count={counts[kind]}
            disabled={counts[kind] === 0}
            onClick={() => onChange(kind)}
          >
            <Icon size={12} />
            {WORK_CHANGE_KIND_LABEL[kind]}
          </FilterButton>
        );
      })}
    </div>
  );
}

function FilterButton({
  selected,
  count,
  disabled = false,
  onClick,
  children,
}: {
  selected: boolean;
  count: number;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "-mb-px flex h-9 items-center gap-1.5 border-b-2 font-jp text-control transition-colors",
        selected ? "border-acc font-semibold text-ink-0" : "border-transparent text-ink-2",
        disabled ? "cursor-not-allowed text-ink-4" : !selected && "hover:text-ink-0",
      )}
    >
      {children}
      <span className="font-mono text-caption tabular-nums text-ink-3">{count}</span>
    </button>
  );
}
