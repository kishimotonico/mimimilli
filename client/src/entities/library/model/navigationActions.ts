import { appRouteAction } from "../../navigation/model/appRouteStore";
import {
  addLibraryTag,
  clearLibrarySort,
  clearLibraryTags,
  goToLibrarySegment,
  openLibraryFolder,
  openLibraryGroupValue,
  openLibraryTag,
  removeLibraryTag,
  reshuffleLibrarySeed,
  searchLibraryInAll,
  selectLibraryGroupValue,
  selectLibraryWork,
  setLibrarySearchQuery,
  setLibrarySort,
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
export const clearLibrarySortAtom = appRouteAction(clearLibrarySort);
export const reshuffleLibrarySeedAtom = appRouteAction(reshuffleLibrarySeed);
export const setLibrarySearchQueryAtom = appRouteAction(setLibrarySearchQuery);
export const searchLibraryInAllAtom = appRouteAction(searchLibraryInAll);
export const goToLibrarySegmentAtom = appRouteAction(goToLibrarySegment);
export const showLibraryWorkAtom = appRouteAction(showLibraryWork);
