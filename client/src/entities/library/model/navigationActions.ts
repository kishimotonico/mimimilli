import { atom } from "jotai";
import { appRouteAction, appRouteCorrection } from "../../navigation/model/appRouteStore";
import { libraryPlaceAtom } from "./navigationAtoms";
import {
  addLibraryTag,
  clearLibraryGroupSort,
  clearLibrarySort,
  isSameScreen,
  reenterLibraryFolder,
  type LibraryPlace,
  clearLibraryTags,
  deselectLibraryWork,
  backToLibraryValueList,
  openLibraryFolder,
  openLibraryGroupValue,
  normalizeLibraryFolder,
  openLibraryTag,
  removeLibraryTag,
  replaceLibraryFolder,
  reshuffleLibrarySeed,
  searchLibraryInAll,
  selectLibraryGroupValue,
  selectLibraryWork,
  setLibraryGroupSort,
  setLibrarySearchQuery,
  setLibrarySort,
  showLibraryWork,
} from "./libraryRouteTransitions";

export const openLibraryFolderAtom = appRouteAction(openLibraryFolder);
export const reenterLibraryFolderAtom = appRouteAction(reenterLibraryFolder);
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

export const replaceLibraryFolderAtom = appRouteCorrection(replaceLibraryFolder);

/** await を挟む保存・追加のあとの入り直し。library が始めたときのままなら、同じ画面（層なし）では
 *  folderId へ入り直す（遷移）。画面や層が変わっていたら、画面と層は動かさず保持中の library だけを
 *  入り直した状態にする（補正）。library をユーザーが変えていたら、その状態を残して何もしない */
export const settleLibraryFolderAtom = atom(
  null,
  (get, set, started: LibraryPlace, folderId: string) => {
    const now = get(libraryPlaceAtom);
    if (now.library !== started.library) return;
    if (isSameScreen(now, started)) set(reenterLibraryFolderAtom, folderId);
    else set(replaceLibraryFolderAtom, folderId, folderId);
  },
);
export const normalizeLibraryFolderAtom = appRouteCorrection(normalizeLibraryFolder);
export const clearLibrarySortAtom = appRouteCorrection(clearLibrarySort);
export const clearLibraryGroupSortAtom = appRouteCorrection(clearLibraryGroupSort);
/** 選択中の作品が絞り込みから外れた・存在しないときの選択解除 */
export const deselectLibraryWorkAtom = appRouteCorrection(deselectLibraryWork);
