// library feature のナビゲーション state フック。
// Jotai atom の読み取りと write-only action atom を束ね、
// setAxis・drillInto・toggleTag などのハイレベル操作を提供する。

import { useAtomValue, useSetAtom } from "jotai";
import type { AxisId, SortId } from "../model/types";
import {
  activeAxisAtom,
  drillValueAtom,
  selectedTagsAtom,
  selectedWorkIdAtom,
  sortAtom,
  addressPathAtom,
} from "./atoms";
import {
  clearLibraryTagsAtom,
  drillBackAtom,
  drillIntoAtom,
  goToLibrarySegmentAtom,
  selectLibraryWorkAtom,
  setLibraryAxisAtom,
  setLibrarySortAtom,
  toggleLibraryTagAtom,
} from "./libraryNavigationActions";

export interface LibraryViewState {
  activeAxis: AxisId;
  drillValue: string | null;
  selectedTags: string[];
  selectedWorkId: string | null;
  sort: SortId;
  addressPath: string[];
}

export interface LibraryViewActions {
  setAxis: (axis: AxisId) => void;
  drillInto: (value: string) => void;
  drillBack: () => void;
  toggleTag: (tag: string) => void;
  clearTags: () => void;
  selectWork: (id: string | null) => void;
  setSort: (sort: SortId) => void;
  goToSegment: (index: number) => void;
}

export function useLibraryView(): LibraryViewState & LibraryViewActions {
  const activeAxis = useAtomValue(activeAxisAtom);
  const drillValue = useAtomValue(drillValueAtom);
  const selectedTags = useAtomValue(selectedTagsAtom);
  const selectedWorkId = useAtomValue(selectedWorkIdAtom);
  const sort = useAtomValue(sortAtom);
  const addressPath = useAtomValue(addressPathAtom);

  const setAxis = useSetAtom(setLibraryAxisAtom);
  const drillInto = useSetAtom(drillIntoAtom);
  const drillBack = useSetAtom(drillBackAtom);
  const toggleTag = useSetAtom(toggleLibraryTagAtom);
  const clearTags = useSetAtom(clearLibraryTagsAtom);
  const selectWork = useSetAtom(selectLibraryWorkAtom);
  const setSort = useSetAtom(setLibrarySortAtom);
  const goToSegment = useSetAtom(goToLibrarySegmentAtom);

  return {
    activeAxis,
    drillValue,
    selectedTags,
    selectedWorkId,
    sort,
    addressPath,
    setAxis,
    drillInto,
    drillBack,
    toggleTag,
    clearTags,
    selectWork,
    setSort,
    goToSegment,
  };
}
