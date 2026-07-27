import { atom } from "jotai";
import { requestNavigationHistoryCommitAtom } from "../../navigation/model/navigationHistoryAtoms";
import type { AxisId, SortId } from "./types";
import {
  activeAxisAtom,
  drillValueAtom,
  selectedTagsAtom,
  selectedWorkIdAtom,
  sortAtom,
} from "./atoms";

export const setLibraryAxisAtom = atom(null, (_get, set, axis: AxisId) => {
  set(requestNavigationHistoryCommitAtom, "push");
  set(activeAxisAtom, axis);
  set(drillValueAtom, null);
  set(selectedTagsAtom, []);
  set(selectedWorkIdAtom, null);
});

export const drillIntoAtom = atom(null, (_get, set, value: string) => {
  set(requestNavigationHistoryCommitAtom, "push");
  set(drillValueAtom, value);
  set(selectedTagsAtom, []);
  set(selectedWorkIdAtom, null);
});

export const drillBackAtom = atom(null, (_get, set) => {
  set(requestNavigationHistoryCommitAtom, "push");
  set(drillValueAtom, null);
  set(selectedWorkIdAtom, null);
});

export const toggleLibraryTagAtom = atom(null, (get, set, tag: string) => {
  set(requestNavigationHistoryCommitAtom, "push");
  const prev = get(selectedTagsAtom);
  set(selectedTagsAtom, prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  set(selectedWorkIdAtom, null);
});

export const clearLibraryTagsAtom = atom(null, (_get, set) => {
  set(requestNavigationHistoryCommitAtom, "push");
  set(selectedTagsAtom, []);
  set(selectedWorkIdAtom, null);
});

export const selectLibraryWorkAtom = atom(null, (_get, set, id: string | null) => {
  set(requestNavigationHistoryCommitAtom, "replace");
  set(selectedWorkIdAtom, id);
});

export const setLibrarySortAtom = atom(null, (_get, set, sort: SortId) => {
  set(requestNavigationHistoryCommitAtom, "replace");
  set(sortAtom, sort);
});

export const goToLibrarySegmentAtom = atom(null, (get, set, index: number) => {
  const activeAxis = get(activeAxisAtom);
  const drillValue = get(drillValueAtom);
  if (index <= 0) {
    if (activeAxis !== "all") set(setLibraryAxisAtom, "all");
    return;
  }
  if (index === 1 && drillValue !== null) set(drillBackAtom);
});
