import { atom } from "jotai";

export type NavigationHistoryCommit = "push" | "replace";

export const navigationHistoryCommitAtom = atom({
  kind: "replace" as NavigationHistoryCommit,
  revision: 0,
});

export const requestNavigationHistoryCommitAtom = atom(
  null,
  (get, set, kind: NavigationHistoryCommit) => {
    const current = get(navigationHistoryCommitAtom);
    set(navigationHistoryCommitAtom, { kind, revision: current.revision + 1 });
  },
);
