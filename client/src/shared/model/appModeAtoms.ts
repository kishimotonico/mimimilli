import { atom } from "jotai";
import { atomWithLazy } from "jotai/utils";
import { readAppModeFromPathname, type AppMode } from "./appMode";
import { requestNavigationHistoryCommit } from "./navigationHistoryCommit";

export const appModeAtom = atomWithLazy<AppMode>(() =>
  readAppModeFromPathname(new URL(window.location.href).pathname),
);

export const setAppModeAtom = atom(null, (get, set, nextMode: AppMode) => {
  if (nextMode === get(appModeAtom)) return;
  requestNavigationHistoryCommit(set, "push");
  set(appModeAtom, nextMode);
});
