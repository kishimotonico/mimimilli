import type { Setter } from "jotai";
import {
  requestNavigationHistoryCommitAtom,
  type NavigationHistoryCommit,
} from "./navigationHistoryAtoms";

export function mergeNavigationHistoryCommitKind(
  current: NavigationHistoryCommit,
  incoming: NavigationHistoryCommit,
): NavigationHistoryCommit {
  return current === "push" || incoming === "push" ? "push" : "replace";
}

export function requestNavigationHistoryCommit(set: Setter, kind: NavigationHistoryCommit): void {
  set(requestNavigationHistoryCommitAtom, kind);
}
