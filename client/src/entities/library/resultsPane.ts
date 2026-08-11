import type { AxisId } from "./types";
import { isFacetAxis } from "./axisDefinitions";

export type ResultsPaneKind = "value-list" | "works";

export function computeResultsPaneKind(axis: AxisId): ResultsPaneKind {
  if (isFacetAxis(axis) || axis === "tag") return "value-list";
  return "works";
}
