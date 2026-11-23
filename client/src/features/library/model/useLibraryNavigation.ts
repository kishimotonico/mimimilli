// library feature のナビゲーション state フック。
// route とスマートフォルダー一覧を resolveLibraryView で突き合わせた結果と、
// write-only action atom を束ねた高レベル操作を提供する（ADR-0041）。

import { useContext, useEffect, useMemo, useTransition } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import {
  type GroupSortId,
  type NormalizedTag,
  type SmartFolder,
  type SortId,
} from "@mimimilli/shared";
import { libraryRouteAtom } from "../../../entities/library/model/navigationAtoms";
import {
  addLibraryTagAtom,
  clearLibraryTagsAtom,
  backToLibraryValueListAtom,
  openLibraryFolderAtom,
  openLibraryGroupValueAtom,
  normalizeLibraryFolderAtom,
  openLibraryTagAtom,
  removeLibraryTagAtom,
  searchLibraryInAllAtom,
  selectLibraryGroupValueAtom,
  selectLibraryWorkAtom,
  setLibrarySearchQueryAtom,
  setLibraryGroupSortAtom,
  setLibrarySortAtom,
} from "../../../entities/library/model/navigationActions";
import {
  resolveLibraryView,
  type ResolvedLibraryView,
} from "../../../entities/library/resolveLibraryView";
import { ApiRequestError } from "../../../shared/api/http";
import { smartFoldersQueryOptions } from "../../../entities/smart-folder/queryOptions";
import { LibraryNavigationContext } from "./libraryNavigationContext";

interface LibraryViewStateBase {
  selectedWorkId: string | null;
  isPending: boolean;
  refetchFolders: () => void;
}

/** スマートフォルダー一覧が揃っていて、route を突き合わせた view がある */
export interface ReadyLibraryViewState extends LibraryViewStateBase {
  foldersStatus: "ready";
  folders: SmartFolder[];
  view: ResolvedLibraryView;
}

/** 一覧を取得中・取得失敗。「まだ分からない」ので view は作らない */
export interface UnavailableLibraryViewState extends LibraryViewStateBase {
  foldersStatus: "pending" | "error";
  /** 取得失敗のときのサーバーの文言 */
  foldersError: string | null;
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
  /** 追加ボタン・Ctrl+クリック用。今の一覧にチップを足す */
  addTag: (tag: NormalizedTag) => void;
  /** プレビュー・作品詳細のタグ。主クリックは「すべて」＋そのタグ、Ctrl/Cmd+クリックは addTag */
  clickTag: (tag: NormalizedTag, modifiers: TagClickModifiers) => void;
  clearTags: () => void;
  searchInAll: () => void;
  /** 検索欄の入力。今の一覧で検索する */
  setSearchQuery: (q: string) => void;
  selectWork: (id: string | null) => void;
  setSort: (sort: SortId) => void;
  setGroupSort: (groupSort: GroupSortId) => void;
  /** グループの値の作品一覧から、そのスマートフォルダーの値一覧へ戻る */
  backToValueList: () => void;
}

export interface TagClickModifiers {
  ctrlKey: boolean;
  metaKey: boolean;
}

export function useLibraryView(): LibraryViewState & LibraryViewActions {
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
  const setGroupSort = useSetAtom(setLibraryGroupSortAtom);
  const backToValueList = useSetAtom(backToLibraryValueListAtom);

  const normalizeFolder = useSetAtom(normalizeLibraryFolderAtom);

  const view = useMemo(
    () => (folders ? resolveLibraryView(library, folders) : null),
    [library, folders],
  );
  useEffect(() => {
    if (folders) normalizeFolder(folders);
  }, [folders, library.folderId, library.group, normalizeFolder]);

  const actions = useMemo<LibraryViewActions>(() => {
    const run = (action: () => void) =>
      startTransition(() => {
        action();
      });
    return {
      openFolder: (folderId) => run(() => openFolder(folderId)),
      openGroupValue: (folderId, group) => run(() => openGroupValue(folderId, group)),
      selectGroupValue: (group) => run(() => selectGroupValue(group)),
      removeTag: (tag) => run(() => removeTag(tag)),
      addTag: (tag) => run(() => addTag(tag)),
      clickTag: (tag, { ctrlKey, metaKey }) =>
        run(() => (ctrlKey || metaKey ? addTag(tag) : openTag(tag))),
      clearTags: () => run(() => clearTags()),
      searchInAll: () => run(() => searchInAll()),
      setSearchQuery: (q) => run(() => setSearchQuery(q)),
      selectWork,
      setSort: (sort) => run(() => setSort(sort)),
      setGroupSort: (groupSort) => run(() => setGroupSort(groupSort)),
      backToValueList: () => run(() => backToValueList()),
    };
  }, [
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
    setGroupSort,
    backToValueList,
  ]);

  const navigation = useMemo<LibraryViewState>(() => {
    const base = {
      selectedWorkId: library.selectedWorkId,
      isPending,
      refetchFolders: () => void refetch(),
    };
    if (foldersQuery.isError || !folders || !view) {
      return {
        ...base,
        foldersStatus: foldersQuery.isError ? "error" : "pending",
        foldersError:
          foldersQuery.error instanceof ApiRequestError ? foldersQuery.error.message : null,
      };
    }
    return {
      ...base,
      foldersStatus: "ready",
      folders,
      view,
    };
  }, [
    folders,
    view,
    foldersQuery.isError,
    foldersQuery.error,
    refetch,
    library.selectedWorkId,
    isPending,
  ]);

  return useMemo(() => ({ ...navigation, ...actions }), [navigation, actions]);
}

export function useLibraryNavigation(): LibraryViewState & LibraryViewActions {
  const navigation = useContext(LibraryNavigationContext);
  if (navigation === null) throw new Error("LibraryNavigationProvider が必要です");
  return navigation;
}
