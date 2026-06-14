import type { AxisId } from "./types";

export interface AxisLandingPresentation {
  panelTitle: string;
  sectionTitle: string;
  instruction: string | null;
}

const AXIS_LABELS: Partial<Record<AxisId, string>> = {
  circle: "サークル",
  cv: "CV",
  series: "シリーズ",
  cat: "カテゴリ",
  tag: "タグ",
  year: "追加日",
};

export function getAxisLandingPresentation(
  axis: AxisId,
  isFilterApplied: boolean
): AxisLandingPresentation {
  const axisLabel = AXIS_LABELS[axis] ?? axis;

  if (isFilterApplied) {
    return {
      panelTitle: "絞り込み結果",
      sectionTitle: `${axisLabel}の結果`,
      instruction: null,
    };
  }

  return {
    panelTitle: "概要",
    sectionTitle: axisLabel,
    instruction: "左の列から絞り込みを選択してください",
  };
}
