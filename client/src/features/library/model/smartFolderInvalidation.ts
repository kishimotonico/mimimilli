import type { QueryClient } from "@tanstack/react-query";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";

/**
 * スマートフォルダーの作成・更新・削除で無効化するクエリ。
 * フォルダー一覧・フォルダー内作品一覧に加えて、そのフォルダー条件付きのファセット
 * （useAxisFacetsQuery の smartFolderId 付きクエリ）を対象にする。通常の（フォルダー
 * 非依存の）軸ファセットは対象に含めない。
 */
export function getSmartFolderSaveInvalidationKeys(smartFolderId: string) {
  return [
    SMART_FOLDER_QUERY_KEYS.all(),
    SMART_FOLDER_QUERY_KEYS.allWorks(),
    WORK_QUERY_KEYS.allScopedFacets(smartFolderId),
  ] as const;
}

export async function invalidateSmartFolderSaveQueries(
  queryClient: QueryClient,
  smartFolderId: string,
): Promise<void> {
  await Promise.all(
    getSmartFolderSaveInvalidationKeys(smartFolderId).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
