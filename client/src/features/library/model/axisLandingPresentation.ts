import type { TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "./types";
import { getAxisLabel } from "./axisDefinitions";

export interface AxisLandingPresentation {
  panelTitle: string;
  sectionTitle: string;
  instruction: string | null;
}

export function getAxisLandingPresentation(
  axis: AxisId,
  isFilterApplied: boolean,
  tagPrefixes: TagPrefix[] = [],
): AxisLandingPresentation {
  const axisLabel = getAxisLabel(axis, tagPrefixes);

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
