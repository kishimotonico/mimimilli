// library feature のナビゲーション state フック。
// Jotai atom の読み取りと write-only action atom を束ね、
// setAxis・drillInto・toggleTag などのハイレベル操作を提供する。

import { createContext, createElement, useContext, useTransition, type ReactNode } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import type { AxisId, SortId } from "../model/types";
import { activeAxisAtom, selectedTagsAtom, selectedWorkIdAtom, sortAtom } from "./atoms";
import {
  clearLibraryTagsAtom,
  goToLibrarySegmentAtom,
  selectLibraryWorkAtom,
  setLibraryAxisAtom,
  setLibrarySortAtom,
  toggleLibraryTagAtom,
} from "./libraryNavigationActions";

export interface LibraryViewState {
  activeAxis: AxisId;
  selectedTags: string[];
  selectedWorkId: string | null;
  sort: SortId;
}

export interface LibraryViewActions {
  setAxis: (axis: AxisId) => void;
  toggleTag: (tag: string) => void;
  clearTags: () => void;
  selectWork: (id: string | null) => void;
  setSort: (sort: SortId) => void;
  goToSegment: (index: number) => void;
  isPending: boolean;
}

export function useLibraryView(): LibraryViewState & LibraryViewActions {
  const activeAxis = useAtomValue(activeAxisAtom);
  const selectedTags = useAtomValue(selectedTagsAtom);
  const selectedWorkId = useAtomValue(selectedWorkIdAtom);
  const sort = useAtomValue(sortAtom);
  const [isPending, startTransition] = useTransition();

  const setAxis = useSetAtom(setLibraryAxisAtom);
  const toggleTag = useSetAtom(toggleLibraryTagAtom);
  const clearTags = useSetAtom(clearLibraryTagsAtom);
  const selectWork = useSetAtom(selectLibraryWorkAtom);
  const setSort = useSetAtom(setLibrarySortAtom);
  const goToSegment = useSetAtom(goToLibrarySegmentAtom);

  const transition =
    <T>(action: (value: T) => void) =>
    (value: T) => {
      startTransition(() => {
        action(value);
      });
    };

  return {
    activeAxis,
    selectedTags,
    selectedWorkId,
    sort,
    setAxis: transition(setAxis),
    toggleTag: transition(toggleTag),
    clearTags: () =>
      startTransition(() => {
        clearTags();
      }),
    selectWork,
    setSort: transition(setSort),
    goToSegment: transition(goToSegment),
    isPending,
  };
}

const LibraryNavigationContext = createContext<(LibraryViewState & LibraryViewActions) | null>(
  null,
);

export function LibraryNavigationProvider({ children }: { children: ReactNode }) {
  const navigation = useLibraryView();
  return createElement(LibraryNavigationContext.Provider, { value: navigation }, children);
}

export function useLibraryNavigation(): LibraryViewState & LibraryViewActions {
  const navigation = useContext(LibraryNavigationContext);
  if (navigation === null) throw new Error("LibraryNavigationProvider が必要です");
  return navigation;
}
