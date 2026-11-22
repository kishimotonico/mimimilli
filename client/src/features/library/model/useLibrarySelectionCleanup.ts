import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { deselectLibraryWorkAtom } from "../../../entities/library/model/navigationActions";
import {
  shouldClearSelectionOnFilterMiss,
  shouldClearSelectionOnWorkNotFound,
} from "./libraryPresentation";
import type { ReadyLibraryNavigation } from "./useLibraryNavigation";

interface UseLibrarySelectionCleanupOptions {
  nav: Pick<ReadyLibraryNavigation, "selectedWorkId">;
  isNoResultsDueToFilter: boolean;
  workDetailError: unknown;
}

/** 選択中作品の解除が必要になった時（検索・フィルタで0件・削除済み作品を開いた等）に選択を外す。
 *  解除は route の補正なので、再生中の層は閉じない */
export function useLibrarySelectionCleanup({
  nav,
  isNoResultsDueToFilter,
  workDetailError,
}: UseLibrarySelectionCleanupOptions) {
  const { selectedWorkId } = nav;
  const deselect = useSetAtom(deselectLibraryWorkAtom);
  // 検索・タグフィルタの絞り込みで作品一覧が0件になったら、含まれなくなった選択中の
  // 作品詳細が残らないよう選択を解除する。
  useEffect(() => {
    if (shouldClearSelectionOnFilterMiss(isNoResultsDueToFilter, selectedWorkId)) deselect();
  }, [isNoResultsDueToFilter, selectedWorkId, deselect]);

  // 存在しない work= パラメータ（削除済み作品など）で開いた場合、404を確認したら
  // 選択を解除してURLをクリーンアップする。404以外（ネットワーク断・5xx等の一時的な
  // 失敗）では選択を維持し、パネル側でエラー表示・再試行を出す（workDetailQuery.isPending/
  // isError は PreviewPane へそのまま渡す）。
  useEffect(() => {
    if (shouldClearSelectionOnWorkNotFound(selectedWorkId, workDetailError)) deselect();
  }, [selectedWorkId, workDetailError, deselect]);
}
