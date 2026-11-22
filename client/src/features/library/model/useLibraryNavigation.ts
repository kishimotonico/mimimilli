// library feature のナビゲーション state フック。
// route とスマートフォルダー一覧を resolveLibraryView で突き合わせた結果と、
// write-only action atom を束ねた高レベル操作を提供する（ADR-0041）。

import { useContext, useMemo, useTransition } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { type NormalizedTag, type SmartFolderItem, type SortId } from "@mimimilli/shared";
import { libraryRouteAtom } from "../../../entities/library/model/navigationAtoms";
import {
  addLibraryTagAtom,
  clearLibraryTagsAtom,
  goToLibrarySegmentAtom,
  openLibraryFolderAtom,
  openLibraryGroupValueAtom,
  openLibraryTagAtom,
  removeLibraryTagAtom,
  searchLibraryInAllAtom,
  selectLibraryGroupValueAtom,
  selectLibraryWorkAtom,
  setLibrarySearchQueryAtom,
  setLibrarySortAtom,
} from "../../../entities/library/model/navigationActions";
import {
  resolveLibraryView,
  type ResolvedLibraryView,
} from "../../../entities/library/resolveLibraryView";
import { smartFoldersQueryOptions } from "../../../entities/smart-folder/queryOptions";
import { LibraryNavigationContext } from "./libraryNavigationContext";
import { LibraryTransitionContext, type StartLibraryTransition } from "./libraryTransitionContext";

interface LibraryViewStateBase {
  selectedWorkId: string | null;
  isPending: boolean;
  refetchFolders: () => void;
}

/** スマートフォルダー一覧が揃っていて、route を突き合わせた view がある */
export interface ReadyLibraryViewState extends LibraryViewStateBase {
  foldersStatus: "ready";
  folders: SmartFolderItem[];
  view: ResolvedLibraryView;
  /** 効いているチップ。作品一覧以外では空 */
  selectedTags: NormalizedTag[];
  /** 効いている検索語。値一覧・読めない行では空（効かない q を見せない） */
  searchQuery: string;
}

/** 一覧を取得中・取得失敗。「まだ分からない」ので view は作らない */
export interface UnavailableLibraryViewState extends LibraryViewStateBase {
  foldersStatus: "pending" | "error";
}

export type ReadyLibraryNavigation = ReadyLibraryViewState & LibraryViewActions;

export type LibraryViewState = ReadyLibraryViewState | UnavailableLibraryViewState;

export interface LibraryViewActions {
  /** サイドバーからの入り直し。今の並びを捨て、チップと検索語を消す */
  openFolder: (folderId: string) => void;
  openGroupValue: (folderId: string, group: string) => void;
  /** 値一覧の値・パンくずの兄弟値。開いているスマートフォルダーの中で値を選ぶ */
  selectGroupValue: (group: string) => void;
  removeTag: (tag: NormalizedTag) => void;
  /** 追加ボタン・Ctrl+クリック用。作品一覧ならチップを足し、値一覧なら「すべて」＋そのチップ */
  addTag: (tag: NormalizedTag) => void;
  /** プレビュー・作品詳細のタグ。主クリックは「すべて」＋そのタグ、Ctrl/Cmd+クリックは addTag */
  clickTag: (tag: NormalizedTag, modifiers: TagClickModifiers) => void;
  clearTags: () => void;
  searchInAll: () => void;
  /** 検索欄の入力。作品一覧ならその一覧で検索し、値一覧なら「すべて」の検索結果へ移る */
  setSearchQuery: (q: string) => void;
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
  const library = useAtomValue(libraryRouteAtom);
  const foldersQuery = useQuery(smartFoldersQueryOptions);
  const folders = foldersQuery.data;
  const { refetch } = foldersQuery;
  const [isPending, startTransition] = useTransition();

  const openFolder = useSetAtom(openLibraryFolderAtom);
  const openGroupValue = useSetAtom(openLibraryGroupValueAtom);
  const selectGroupValue = useSetAtom(selectLibraryGroupValueAtom);
  const removeTag = useSetAtom(removeLibraryTagAtom);
  const addTag = useSetAtom(addLibraryTagAtom);
  const openTag = useSetAtom(openLibraryTagAtom);
  const clearTags = useSetAtom(clearLibraryTagsAtom);
  const searchInAll = useSetAtom(searchLibraryInAllAtom);
  const setSearchQuery = useSetAtom(setLibrarySearchQueryAtom);
  const selectWork = useSetAtom(selectLibraryWorkAtom);
  const setSort = useSetAtom(setLibrarySortAtom);
  const goToSegment = useSetAtom(goToLibrarySegmentAtom);

  const view = useMemo(
    () => (folders ? resolveLibraryView(library, folders) : null),
    [library, folders],
  );
  const heldKind = view?.kind ?? null;

  const actions = useMemo<LibraryViewActions>(() => {
    const run = (action: () => void) =>
      startTransition(() => {
        action();
      });
    // 一覧が無い間は保持しているライブラリの種別が決まらないので、種別に依存する操作は行わない
    const add = (tag: NormalizedTag) => {
      if (heldKind !== null) run(() => addTag(tag, heldKind));
    };
    return {
      openFolder: (folderId) => run(() => openFolder(folderId)),
      openGroupValue: (folderId, group) => run(() => openGroupValue(folderId, group)),
      selectGroupValue: (group) => run(() => selectGroupValue(group)),
      removeTag: (tag) => run(() => removeTag(tag)),
      addTag: add,
      clickTag: (tag, { ctrlKey, metaKey }) =>
        ctrlKey || metaKey ? add(tag) : run(() => openTag(tag)),
      clearTags: () => run(() => clearTags()),
      searchInAll: () => run(() => searchInAll()),
      setSearchQuery: (q) => {
        if (heldKind !== null) run(() => setSearchQuery(q, heldKind));
      },
      selectWork,
      setSort: (sort) => run(() => setSort(sort)),
      goToSegment: (index) => run(() => goToSegment(index)),
    };
  }, [
    heldKind,
    openFolder,
    openGroupValue,
    selectGroupValue,
    removeTag,
    addTag,
    openTag,
    clearTags,
    searchInAll,
    setSearchQuery,
    selectWork,
    setSort,
    goToSegment,
  ]);

  const navigation = useMemo<LibraryViewState>(() => {
    const base = {
      selectedWorkId: library.selectedWorkId,
      isPending,
      refetchFolders: () => void refetch(),
    };
    if (!folders || !view) {
      return { ...base, foldersStatus: foldersQuery.isError ? "error" : "pending" };
    }
    return {
      ...base,
      foldersStatus: "ready",
      folders,
      view,
      selectedTags: view.kind === "works" ? view.selectedTags : EMPTY_TAGS,
      searchQuery: view.kind === "works" ? view.q : "",
    };
  }, [folders, view, foldersQuery.isError, refetch, library.selectedWorkId, isPending]);

  const value = useMemo(() => ({ ...navigation, ...actions }), [navigation, actions]);

  return { navigation: value, startTransition };
}

const EMPTY_TAGS: NormalizedTag[] = [];

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
