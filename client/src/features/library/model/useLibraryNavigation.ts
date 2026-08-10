// library feature のナビゲーション state フック。
// Jotai atom の読み取りと write-only action atom を束ね、
// setAxis・drillInto・toggleTag などのハイレベル操作を提供する。

import { useContext, useTransition } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import type { NormalizedTag } from "@mimimilli/shared";
import type { AxisId, SortId } from "../../../entities/library/types";
import {
  activeAxisAtom,
  selectedTagsAtom,
  selectedWorkIdAtom,
  sortAtom,
} from "../../../entities/library/model/navigationAtoms";
import {
  addLibraryTagAtom,
  clearLibraryTagsAtom,
  goToLibrarySegmentAtom,
  replaceLibraryTagAtom,
  selectLibraryWorkAtom,
  selectSoleLibraryTagAtom,
  setLibraryAxisAtom,
  setLibrarySortAtom,
  toggleLibraryTagAtom,
} from "../../../entities/library/model/navigationActions";
import { LibraryNavigationContext } from "./libraryNavigationContext";

export interface LibraryViewState {
  activeAxis: AxisId;
  selectedTags: NormalizedTag[];
  selectedWorkId: string | null;
  sort: SortId;
}

export interface LibraryViewActions {
  setAxis: (axis: AxisId) => void;
  toggleTag: (tag: NormalizedTag) => void;
  /** 既定=置き換え操作（ADR-0013）。既存選択を全て外して1つだけにし、結果面を作品一覧へ
   *  進める（既に作品一覧ならそのまま）。全入口共通の単一の規則 */
  replaceTag: (tag: NormalizedTag) => void;
  /** 追加ボタン用の冪等なAND追加（ADR-0013）。既に選択済みなら何もしない */
  addTag: (tag: NormalizedTag) => void;
  selectSoleTag: (tag: NormalizedTag) => void;
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
  const replaceTag = useSetAtom(replaceLibraryTagAtom);
  const addTag = useSetAtom(addLibraryTagAtom);
  const selectSoleTag = useSetAtom(selectSoleLibraryTagAtom);
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
    replaceTag: transition(replaceTag),
    addTag: transition(addTag),
    selectSoleTag: transition(selectSoleTag),
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

export function useLibraryNavigation(): LibraryViewState & LibraryViewActions {
  const navigation = useContext(LibraryNavigationContext);
  if (navigation === null) throw new Error("LibraryNavigationProvider が必要です");
  return navigation;
}
