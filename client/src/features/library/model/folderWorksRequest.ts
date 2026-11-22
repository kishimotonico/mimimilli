// スマートフォルダーの作品一覧の要求と query key。作品一覧を決める項目はここだけで列挙する。

import { hashKey, type QueryKey } from "@tanstack/react-query";
import { normalizeSearchQuery } from "@mimimilli/shared";
import type { SmartFolderWorksParams } from "../../../entities/smart-folder/api";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import type { WorksView } from "../../../entities/library/resolveLibraryView";

/** 作品一覧の要求。ページ以外は解決済みの値だけで決まる（今の並び・既定・seed の違いは結果の違い） */
export function folderWorksParams(
  view: WorksView,
  searchQuery: string,
): Omit<SmartFolderWorksParams, "page" | "limit"> {
  return {
    q: normalizeSearchQuery(searchQuery),
    tags: view.selectedTags,
    group: view.group,
    sort: view.sort,
    seed: view.seed,
  };
}

/** スマートフォルダーの作品一覧の query key。seed は並びの一部なのでキーに含める */
export function folderWorksKey(view: WorksView, searchQuery: string): QueryKey {
  return SMART_FOLDER_QUERY_KEYS.works(view.folder.id, folderWorksParams(view, searchQuery));
}

/** 作品一覧の描画結果（グリッド・リスト・エラー境界）を再マウントすべきタイミングを表すキー。
 *  取得するクエリが変わるときだけ変わる */
export function folderWorksResetKey(view: WorksView, searchQuery: string): string {
  return hashKey(folderWorksKey(view, searchQuery));
}
