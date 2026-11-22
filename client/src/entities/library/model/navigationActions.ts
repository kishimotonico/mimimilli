import { appRouteStore } from "../../navigation/model/appRouteStore";
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

export const openLibraryFolderAtom = appRouteStore.action(openLibraryFolder);
export const openLibraryGroupValueAtom = appRouteStore.action(openLibraryGroupValue);
export const selectLibraryGroupValueAtom = appRouteStore.action(selectLibraryGroupValue);
export const openLibraryTagAtom = appRouteStore.action(openLibraryTag);
export const addLibraryTagAtom = appRouteStore.action(addLibraryTag);
export const removeLibraryTagAtom = appRouteStore.action(removeLibraryTag);
export const clearLibraryTagsAtom = appRouteStore.action(clearLibraryTags);
export const selectLibraryWorkAtom = appRouteStore.action(selectLibraryWork);
export const setLibrarySortAtom = appRouteStore.action(setLibrarySort);
export const clearLibrarySortAtom = appRouteStore.action(clearLibrarySort);
export const reshuffleLibrarySeedAtom = appRouteStore.action(reshuffleLibrarySeed);
export const setLibrarySearchQueryAtom = appRouteStore.action(setLibrarySearchQuery);
export const searchLibraryInAllAtom = appRouteStore.action(searchLibraryInAll);
export const goToLibrarySegmentAtom = appRouteStore.action(goToLibrarySegment);
export const showLibraryWorkAtom = appRouteStore.action(showLibraryWork);
