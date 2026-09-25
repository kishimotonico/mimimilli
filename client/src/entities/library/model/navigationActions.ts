import { appRouteStore } from "../../navigation/model/appRouteStore";
import {
  addLibraryTag,
  clearLibraryTags,
  goToLibrarySegment,
  replaceLibraryTag,
  selectLibraryWork,
  setLibraryAxis,
  setLibrarySearchQuery,
  setLibrarySort,
  showLibraryWork,
  toggleLibraryTag,
} from "./libraryRouteTransitions";

export const setLibraryAxisAtom = appRouteStore.action(setLibraryAxis);
export const toggleLibraryTagAtom = appRouteStore.action(toggleLibraryTag);
export const addLibraryTagAtom = appRouteStore.action(addLibraryTag);
export const replaceLibraryTagAtom = appRouteStore.action(replaceLibraryTag);
export const clearLibraryTagsAtom = appRouteStore.action(clearLibraryTags);
export const selectLibraryWorkAtom = appRouteStore.action(selectLibraryWork);
export const setLibrarySortAtom = appRouteStore.action(setLibrarySort);
export const setLibrarySearchQueryAtom = appRouteStore.action(setLibrarySearchQuery);
export const goToLibrarySegmentAtom = appRouteStore.action(goToLibrarySegment);
export const showLibraryWorkAtom = appRouteStore.action(showLibraryWork);
