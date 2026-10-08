// library feature のナビゲーション state フック。
// Jotai atom の読み取りと write-only action atom を束ね、
// setAxis・drillInto・toggleTag などのハイレベル操作を提供する。

import { useContext, useMemo, useTransition } from "react";
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
  setLibraryAxisAtom,
  setLibrarySortAtom,
  toggleLibraryTagAtom,
} from "../../../entities/library/model/navigationActions";
import { LibraryNavigationContext } from "./libraryNavigationContext";
import { LibraryTransitionContext, type StartLibraryTransition } from "./libraryTransitionContext";

export interface LibraryViewState {
  activeAxis: AxisId;
  selectedTags: NormalizedTag[];
  selectedWorkId: string | null;
  sort: SortId;
  isPending: boolean;
}

export interface LibraryViewActions {
  setAxis: (axis: AxisId) => void;
  toggleTag: (tag: NormalizedTag) => void;
  /** 既定=置き換え操作（ADR-0013）。既存選択を全て外して1つだけにし、結果面を作品一覧へ
   *  進める（既に作品一覧ならそのまま）。全入口共通の単一の規則 */
  replaceTag: (tag: NormalizedTag) => void;
  /** 追加ボタン用の冪等なAND追加（ADR-0013）。既に選択済みなら何もしない */
  addTag: (tag: NormalizedTag) => void;
  /** タグチップのクリック規則（ADR-0013）。Ctrl/Cmd+クリックはAND追加、それ以外は置き換え */
  clickTag: (tag: NormalizedTag, modifiers: TagClickModifiers) => void;
  clearTags: () => void;
  selectWork: (id: string | null) => void;
  setSort: (sort: SortId) => void;
  goToSegment: (index: number) => void;
}

export interface TagClickModifiers {
  ctrlKey: boolean;
  metaKey: boolean;
}

export function useLibraryView(): {
  navigation: LibraryViewState & LibraryViewActions;
  startTransition: StartLibraryTransition;
} {
  const activeAxis = useAtomValue(activeAxisAtom);
  const selectedTags = useAtomValue(selectedTagsAtom);
  const selectedWorkId = useAtomValue(selectedWorkIdAtom);
  const sort = useAtomValue(sortAtom);
  const [isPending, startTransition] = useTransition();

  const setAxis = useSetAtom(setLibraryAxisAtom);
  const toggleTag = useSetAtom(toggleLibraryTagAtom);
  const replaceTag = useSetAtom(replaceLibraryTagAtom);
  const addTag = useSetAtom(addLibraryTagAtom);
  const clearTags = useSetAtom(clearLibraryTagsAtom);
  const selectWork = useSetAtom(selectLibraryWorkAtom);
  const setSort = useSetAtom(setLibrarySortAtom);
  const goToSegment = useSetAtom(goToLibrarySegmentAtom);

  const actions = useMemo<LibraryViewActions>(() => {
    const transition =
      <T>(action: (value: T) => void) =>
      (value: T) => {
        startTransition(() => {
          action(value);
        });
      };
    const replace = transition(replaceTag);
    const add = transition(addTag);
    return {
      setAxis: transition(setAxis),
      toggleTag: transition(toggleTag),
      replaceTag: replace,
      addTag: add,
      clickTag: (tag, { ctrlKey, metaKey }) => (ctrlKey || metaKey ? add(tag) : replace(tag)),
      clearTags: () =>
        startTransition(() => {
          clearTags();
        }),
      selectWork,
      setSort: transition(setSort),
      goToSegment: transition(goToSegment),
    };
  }, [
    startTransition,
    setAxis,
    toggleTag,
    replaceTag,
    addTag,
    clearTags,
    selectWork,
    setSort,
    goToSegment,
  ]);

  const navigation = useMemo(
    () => ({ activeAxis, selectedTags, selectedWorkId, sort, isPending, ...actions }),
    [activeAxis, selectedTags, selectedWorkId, sort, isPending, actions],
  );

  return { navigation, startTransition };
}

export function useLibraryNavigation(): LibraryViewState & LibraryViewActions {
  const navigation = useContext(LibraryNavigationContext);
  if (navigation === null) throw new Error("LibraryNavigationProvider が必要です");
  return navigation;
}

/** アクションのみ必要な消費者用。useLibraryNavigation() の state 購読を避ける。 */
export function useLibraryTransition(): StartLibraryTransition {
  const startTransition = useContext(LibraryTransitionContext);
  if (startTransition === null) throw new Error("LibraryNavigationProvider が必要です");
  return startTransition;
}
