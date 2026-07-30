import { atom } from "jotai";
import { mergeNavigationHistoryCommitKind } from "./navigationHistoryCommit";

export type NavigationHistoryCommit = "push" | "replace";

export interface NavigationHistoryCommitState {
  kind: NavigationHistoryCommit;
  revision: number;
  /** useNavigationHistory が未消費のバッチか。false なら次の宣言は kind をそのまま採用する。 */
  pending: boolean;
}

export const navigationHistoryCommitAtom = atom<NavigationHistoryCommitState>({
  kind: "replace",
  revision: 0,
  pending: false,
});

export const requestNavigationHistoryCommitAtom = atom(
  null,
  (get, set, kind: NavigationHistoryCommit) => {
    const current = get(navigationHistoryCommitAtom);
    const nextKind = current.pending ? mergeNavigationHistoryCommitKind(current.kind, kind) : kind;
    set(navigationHistoryCommitAtom, {
      kind: nextKind,
      revision: current.revision + 1,
      pending: true,
    });
  },
);

export const consumeNavigationHistoryCommitAtom = atom(null, (get, set) => {
  const current = get(navigationHistoryCommitAtom);
  if (!current.pending) return;
  set(navigationHistoryCommitAtom, {
    kind: "replace",
    revision: current.revision,
    pending: false,
  });
});

export interface NavigationHistoryState {
  canBack: boolean;
  canForward: boolean;
}

export const navigationHistoryStateAtom = atom<NavigationHistoryState>({
  canBack: false,
  canForward: false,
});
