import { atom } from "jotai";
import { atomWithLazy } from "jotai/utils";
import { parseNavigationUrl, type AppMode } from "./navigationUrl";
import { requestNavigationHistoryCommitAtom } from "./navigationHistoryAtoms";

// 初期モードは現在のURLから決める（初回描画で誤ったビューをマウントしないため）。
// atomWithLazy はストアごとの初回読み取り時に評価するので、モジュール読み込み時に
// 固定されない（Provider を作り直すテストが実行順に依存しない）。
export const appModeAtom = atomWithLazy<AppMode>(
  () => parseNavigationUrl(window.location.href).state.mode,
);

export const setAppModeAtom = atom(null, (get, set, nextMode: AppMode) => {
  if (nextMode === get(appModeAtom)) return;
  set(requestNavigationHistoryCommitAtom, "push");
  set(appModeAtom, nextMode);
});
