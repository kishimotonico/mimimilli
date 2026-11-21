import type { WorkChangeKind } from "@mimimilli/shared";
import { WORK_CHANGE_KIND_LABEL, WORK_CHANGE_KIND_ORDER } from "../../../model/describeWorkChange";
import ScanFilterChip from "../ScanFilterChip";

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
    <div className="flex h-[46px] shrink-0 items-center justify-end gap-2.5 px-[18px]">
      <ScanFilterChip pressed={value === null} count={total} onClick={() => onChange(null)}>
        すべて
      </ScanFilterChip>
      {WORK_CHANGE_KIND_ORDER.filter((kind) => counts[kind] > 0).map((kind) => (
        <ScanFilterChip
          key={kind}
          pressed={value === kind}
          count={counts[kind]}
          onClick={() => onChange(kind)}
        >
          {WORK_CHANGE_KIND_LABEL[kind]}
        </ScanFilterChip>
      ))}
    </div>
  );
}
