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

/** 404・削除など、現在の画面自体が無効になったための強制退避で使う。履歴を積まず
 *  現在のエントリを置き換える（戻るで無効な画面へ戻ってpush→retreatを繰り返すのを防ぐ）。 */
export const replaceAppModeAtom = atom(null, (get, set, nextMode: AppMode) => {
  if (nextMode === get(appModeAtom)) return;
  requestNavigationHistoryCommit(set, "replace");
  set(appModeAtom, nextMode);
});
