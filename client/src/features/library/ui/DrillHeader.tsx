import { useAtomValue } from "jotai";
import { I } from "../../../shared/ui/Icon";
import { tagPrefixesAtom } from "../model/atoms";
import { getAxisLabel } from "../model/axisDefinitions";
import type { AxisId } from "../model/types";

interface DrillHeaderProps {
  axisLabel: AxisId;
  value: string;
  count?: number;
  onBack: () => void;
}

export default function DrillHeader({ axisLabel, value, count, onBack }: DrillHeaderProps) {
  const tagPrefixes = useAtomValue(tagPrefixesAtom);
  const label = getAxisLabel(axisLabel, tagPrefixes);
  return (
    <div className="mle-drill">
      <button type="button" className="mle-drill__crumb" onClick={onBack}>
        <span className="mle-drill__back">
          <I.arrowL size={13} />
        </span>
        <span className="mle-drill__axis">{label}</span>
        <span className="mle-drill__sep">/</span>
        <span className="mle-drill__val">{value}</span>
        {count != null && <span className="mle-drill__count">{count}</span>}
        <span className="mle-drill__chev">
          <I.chevD size={11} />
        </span>
      </button>
      <div className="mle-drill__sub">
        <span>この {label} の作品</span>
        {count != null && <span className="count">{count}</span>}
      </div>
    </div>
  );
}
