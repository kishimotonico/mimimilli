import type { QueryClient } from "@tanstack/react-query";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";

/**
 * スキャン経由でライブラリの中身が変わった後に無効化するクエリ（TASK-428.3）。
 * スキャン完了時の自動登録・候補タブからの手動登録のどちらでも「作品が増減した」という
 * 事実は同じなので、作品一覧・軸件数・スマートフォルダー・DLsite通知の集計を一本化する。
 */
export function getLibraryInvalidationKeys() {
  return [
    WORK_QUERY_KEYS.all(),
    WORK_QUERY_KEYS.allFacets(),
    WORK_QUERY_KEYS.dlsiteNotifications(),
    SMART_FOLDER_QUERY_KEYS.allWorks(),
  ] as const;
}

export async function invalidateLibraryQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    getLibraryInvalidationKeys().map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
