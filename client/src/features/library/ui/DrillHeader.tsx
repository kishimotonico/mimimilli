import { I } from "../../../shared/ui/Icon";

interface DrillHeaderProps {
  axisLabel: string;
  value: string;
  count?: number;
  onBack: () => void;
}

const AXIS_LABELS: Record<string, string> = {
  circle: "サークル",
  cv: "CV",
  series: "シリーズ",
  cat: "カテゴリ",
  tag: "タグ",
  year: "追加日",
};

export default function DrillHeader({ axisLabel, value, count, onBack }: DrillHeaderProps) {
  const label = AXIS_LABELS[axisLabel] ?? axisLabel;
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
