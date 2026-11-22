import {
  appRouteAction,
  appRouteCorrection,
  appRouteStore,
} from "../../navigation/model/appRouteStore";
import {
  addLibraryTag,
  clearLibrarySort,
  enterLibraryFolderFrom,
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
/** 画面と層を引き戻さないよう、遷移の規則（層を落とす）は通さない */
export const enterLibraryFolderFromAtom = appRouteStore.action(enterLibraryFolderFrom);
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
export const normalizeLibraryFolderAtom = appRouteCorrection(normalizeLibraryFolder);
export const clearLibrarySortAtom = appRouteCorrection(clearLibrarySort);
/** 選択中の作品が絞り込みから外れた・存在しないときの選択解除 */
export const deselectLibraryWorkAtom = appRouteCorrection(deselectLibraryWork);
