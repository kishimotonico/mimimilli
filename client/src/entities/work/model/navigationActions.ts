import { atom } from "jotai";
import { appModeAtom } from "../../../shared/model/appModeAtoms";
import { requestNavigationHistoryCommit } from "../../../shared/model/navigationHistoryCommit";
import { workDetailIdAtom } from "./navigationAtoms";

/** 全画面作品詳細（/work/:id）へ遷移する。ライブラリ右ペイン・再生中タブどちらからも使う。 */
export const openWorkDetailAtom = atom(null, (_get, set, workId: string) => {
  requestNavigationHistoryCommit(set, "push");
  set(workDetailIdAtom, workId);
  set(appModeAtom, "workDetail");
});
