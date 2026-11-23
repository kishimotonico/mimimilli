import { atom } from "jotai";
import type { AppRoute } from "../../navigation/model/appRoute";
import {
  appRouteAction,
  appRouteAtom,
  appRouteCorrection,
} from "../../navigation/model/appRouteStore";
import {
  addLibraryTag,
  clearLibraryTags,
  deselectLibraryWork,
  dropLibraryGroup,
  backToLibraryValueList,
  openLibraryFolder,
  openLibraryGroupValue,
  normalizeLibraryFolder,
  openLibraryTag,
  removeLibraryTag,
  reshuffleLibrarySeed,
  searchLibraryInAll,
  selectLibraryGroupValue,
  selectLibraryWork,
  setLibraryGroupSort,
  setLibrarySearchQuery,
  setLibrarySort,
  settleLibraryFolder,
  showLibraryWork,
} from "./libraryRouteTransitions";

export const openLibraryFolderAtom = appRouteAction(openLibraryFolder);
export const openLibraryGroupValueAtom = appRouteAction(openLibraryGroupValue);
export const selectLibraryGroupValueAtom = appRouteAction(selectLibraryGroupValue);
export const openLibraryTagAtom = appRouteAction(openLibraryTag);
export const addLibraryTagAtom = appRouteAction(addLibraryTag);
export const removeLibraryTagAtom = appRouteAction(removeLibraryTag);
export const clearLibraryTagsAtom = appRouteAction(clearLibraryTags);
export const selectLibraryWorkAtom = appRouteAction(selectLibraryWork);
export const setLibrarySortAtom = appRouteAction(setLibrarySort);
export const setLibraryGroupSortAtom = appRouteAction(setLibraryGroupSort);
export const reshuffleLibrarySeedAtom = appRouteAction(reshuffleLibrarySeed);
export const setLibrarySearchQueryAtom = appRouteAction(setLibrarySearchQuery);
export const searchLibraryInAllAtom = appRouteAction(searchLibraryInAll);
export const backToLibraryValueListAtom = appRouteAction(backToLibraryValueList);
export const showLibraryWorkAtom = appRouteAction(showLibraryWork);

const settleTransitionAtom = appRouteAction(settleLibraryFolder);

/** await をはさむ保存・作成のあと、folderId へ移る。始めたときの route（不変のオブジェクト）から動いていなければ
 *  移り、動いていれば何もしない。新規は履歴を積み、上書き（overwrite）は置き換える */
export const settleLibraryFolderAtom = atom(
  null,
  (get, set, started: AppRoute, folderId: string, overwrite?: boolean) => {
    if (get(appRouteAtom) !== started) return;
    set(settleTransitionAtom, folderId, overwrite ?? false);
  },
);
export const normalizeLibraryFolderAtom = appRouteCorrection(normalizeLibraryFolder);
export const dropLibraryGroupAtom = appRouteCorrection(dropLibraryGroup);
/** 選択中の作品が絞り込みから外れた・存在しないときの選択解除 */
export const deselectLibraryWorkAtom = appRouteCorrection(deselectLibraryWork);
