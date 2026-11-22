import { atom } from "jotai";
import { appRouteAction, appRouteCorrection } from "../../navigation/model/appRouteStore";
import { libraryPlaceAtom } from "./navigationAtoms";
import {
  addLibraryTag,
  clearLibrarySort,
  isSamePlace,
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
export const reshuffleLibrarySeedAtom = appRouteAction(reshuffleLibrarySeed);
export const setLibrarySearchQueryAtom = appRouteAction(setLibrarySearchQuery);
export const searchLibraryInAllAtom = appRouteAction(searchLibraryInAll);
export const backToLibraryValueListAtom = appRouteAction(backToLibraryValueList);
export const showLibraryWorkAtom = appRouteAction(showLibraryWork);

export const replaceLibraryFolderAtom = appRouteCorrection(replaceLibraryFolder);

/** await を挟む保存・追加のあと、始めたときと同じ場所なら folderId へ入り直す（遷移）。
 *  その間に層を開いた・別の画面へ移ったときは、画面を動かさず補正だけ行う */
export const settleLibraryFolderAtom = atom(
  null,
  (get, set, started: LibraryPlace, folderId: string) => {
    if (isSamePlace(get(libraryPlaceAtom), started)) set(reenterLibraryFolderAtom, folderId);
    else set(replaceLibraryFolderAtom, folderId, folderId);
  },
);
export const normalizeLibraryFolderAtom = appRouteCorrection(normalizeLibraryFolder);
export const clearLibrarySortAtom = appRouteCorrection(clearLibrarySort);
/** 選択中の作品が絞り込みから外れた・存在しないときの選択解除 */
export const deselectLibraryWorkAtom = appRouteCorrection(deselectLibraryWork);
