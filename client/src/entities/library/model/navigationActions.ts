import { atom } from "jotai";
import {
  createRandomSeed,
  isBuiltinPseudoTagAxis,
  parseBuiltinAxisTag,
  type NormalizedTag,
} from "@mimimilli/shared";
import { requestNavigationHistoryCommit } from "../../../shared/model/navigationHistoryCommit";
import { computeResultsPaneKind } from "../resultsPane";
import type { AxisId, SortId } from "../types";
import {
  activeAxisAtom,
  randomSeedAtom,
  selectedTagsAtom,
  selectedWorkIdAtom,
  sortAtom,
} from "./navigationAtoms";

export const setLibraryAxisAtom = atom(null, (_get, set, axis: AxisId) => {
  requestNavigationHistoryCommit(set, "push");
  set(activeAxisAtom, axis);
  set(selectedWorkIdAtom, null);
});

export const toggleLibraryTagAtom = atom(null, (get, set, tag: NormalizedTag) => {
  requestNavigationHistoryCommit(set, "push");
  const prev = get(selectedTagsAtom);
  if (prev.includes(tag)) {
    set(
      selectedTagsAtom,
      prev.filter((t) => t !== tag),
    );
  } else {
    const builtin = parseBuiltinAxisTag(tag);
    const base =
      builtin && isBuiltinPseudoTagAxis(builtin.axis)
        ? prev.filter((t) => parseBuiltinAxisTag(t)?.axis !== builtin.axis)
        : prev;
    set(selectedTagsAtom, [...base, tag]);
  }
  set(selectedWorkIdAtom, null);
});

export const addLibraryTagAtom = atom(null, (get, set, tag: NormalizedTag) => {
  const prev = get(selectedTagsAtom);
  if (prev.includes(tag)) return;
  requestNavigationHistoryCommit(set, "push");
  const builtin = parseBuiltinAxisTag(tag);
  const base =
    builtin && isBuiltinPseudoTagAxis(builtin.axis)
      ? prev.filter((t) => parseBuiltinAxisTag(t)?.axis !== builtin.axis)
      : prev;
  set(selectedTagsAtom, [...base, tag]);
  set(selectedWorkIdAtom, null);
});

export const selectSoleLibraryTagAtom = atom(null, (_get, set, tag: NormalizedTag) => {
  requestNavigationHistoryCommit(set, "push");
  set(activeAxisAtom, "tag");
  set(selectedTagsAtom, [tag]);
  set(selectedWorkIdAtom, null);
});

export const replaceLibraryTagAtom = atom(null, (get, set, tag: NormalizedTag) => {
  requestNavigationHistoryCommit(set, "push");
  set(selectedTagsAtom, [tag]);
  if (computeResultsPaneKind(get(activeAxisAtom)) !== "works") {
    set(activeAxisAtom, "all");
  }
  set(selectedWorkIdAtom, null);
});

export const clearLibraryTagsAtom = atom(null, (_get, set) => {
  requestNavigationHistoryCommit(set, "push");
  set(selectedTagsAtom, []);
  set(selectedWorkIdAtom, null);
});

export const selectLibraryWorkAtom = atom(null, (get, set, id: string | null) => {
  const wasUnselected = get(selectedWorkIdAtom) === null;
  requestNavigationHistoryCommit(set, wasUnselected && id !== null ? "push" : "replace");
  set(selectedWorkIdAtom, id);
});

export const setLibrarySortAtom = atom(null, (_get, set, sort: SortId) => {
  requestNavigationHistoryCommit(set, "replace");
  set(sortAtom, sort);
});

export const reshuffleLibraryRandomSeedAtom = atom(null, (_get, set) => {
  set(randomSeedAtom, createRandomSeed());
});

export const goToLibrarySegmentAtom = atom(null, (get, set, index: number) => {
  const activeAxis = get(activeAxisAtom);
  if (index <= 0 && activeAxis !== "all") set(setLibraryAxisAtom, "all");
});
