import { useEffect } from "react";
import {
  shouldClearSelectionOnFilterMiss,
  shouldClearSelectionOnWorkNotFound,
} from "./libraryPresentation";
import type { LibraryViewActions, LibraryViewState } from "./useLibraryNavigation";

interface UseLibrarySelectionCleanupOptions {
  nav: LibraryViewState & LibraryViewActions;
  isNoResultsDueToFilter: boolean;
  workDetailError: unknown;
}

/** 選択中作品の解除が必要になった時（検索・フィルタで0件・削除済み作品を開いた等）に選択を外す。 */
export function useLibrarySelectionCleanup({
  nav,
  isNoResultsDueToFilter,
  workDetailError,
}: UseLibrarySelectionCleanupOptions) {
  const { selectedWorkId, selectWork } = nav;
  // 検索・タグフィルタの絞り込みで作品一覧が0件になったら、含まれなくなった選択中の
  // 作品詳細が残らないよう選択を解除する。
  useEffect(() => {
    if (shouldClearSelectionOnFilterMiss(isNoResultsDueToFilter, selectedWorkId)) {
      selectWork(null);
    }
  }, [isNoResultsDueToFilter, selectedWorkId, selectWork]);

  // 存在しない work= パラメータ（削除済み作品など）で開いた場合、404を確認したら
  // 選択を解除してURLをクリーンアップする。404以外（ネットワーク断・5xx等の一時的な
  // 失敗）では選択を維持し、パネル側でエラー表示・再試行を出す（workDetailQuery.isPending/
  // isError は PreviewPane へそのまま渡す）。
  useEffect(() => {
    if (shouldClearSelectionOnWorkNotFound(selectedWorkId, workDetailError)) {
      selectWork(null);
    }
  }, [selectedWorkId, workDetailError, selectWork]);
}
