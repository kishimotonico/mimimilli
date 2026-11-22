import { appRouteAction, appRouteCorrection } from "../../navigation/model/appRouteStore";
import {
  addLibraryTag,
  clearLibrarySort,
  clearLibraryTags,
  deselectLibraryWork,
  backToLibraryValueList,
  openLibraryFolder,
  openLibraryGroupValue,
  openLibraryTag,
  reenterLibraryFolder,
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
export const clearLibrarySortAtom = appRouteCorrection(clearLibrarySort);
/** 選択中の作品が絞り込みから外れた・存在しないときの選択解除 */
export const deselectLibraryWorkAtom = appRouteCorrection(deselectLibraryWork);
