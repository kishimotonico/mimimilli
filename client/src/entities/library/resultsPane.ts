import type { AxisId } from "./types";
import { isFacetAxis, isHomeAxis } from "./axisDefinitions";

export type ResultsPaneKind = "home" | "value-list" | "works";

export function computeResultsPaneKind(axis: AxisId): ResultsPaneKind {
  if (isHomeAxis(axis)) return "home";
  if (isFacetAxis(axis) || axis === "tag") return "value-list";
  return "works";
}
