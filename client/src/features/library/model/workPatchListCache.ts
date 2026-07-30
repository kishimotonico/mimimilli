// PATCH 後の一覧 infinite query キャッシュ操作。
// アクティブ一覧は単一クエリへの DTO 差し替え、非表示一覧は stale 化のみ。

import type { InfiniteData, Query, QueryClient, QueryKey } from "@tanstack/react-query";
import {
  getDefaultPlaylistTrackCount,
  toWorkListItem,
  type Work,
  type WorkListItem,
  type WorksPage,
} from "@mimimilli/shared";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";

export function workToListItem(work: Work): WorkListItem {
  return toWorkListItem({
    ...work,
    trackCount: getDefaultPlaylistTrackCount(work),
  });
}

function patchWorkInInfiniteData(
  data: InfiniteData<WorksPage>,
  workId: string,
  listItem: WorkListItem,
): InfiniteData<WorksPage> | null {
  let changed = false;
  const pages = data.pages.map((page) => {
    const items = page.items.map((item) => {
      if (item.id !== workId) return item;
      changed = true;
      return listItem;
    });
    return items === page.items ? page : { ...page, items };
  });
  return changed ? { ...data, pages } : null;
}

function isInfiniteWorksData(data: unknown): data is InfiniteData<WorksPage> {
  return (
    typeof data === "object" &&
    data !== null &&
    "pages" in data &&
    Array.isArray((data as InfiniteData<WorksPage>).pages)
  );
}

export function patchWorkInQueryCache(
  queryClient: QueryClient,
  queryKey: QueryKey,
  workId: string,
  listItem: WorkListItem,
): void {
  const data = queryClient.getQueryData<InfiniteData<WorksPage>>(queryKey);
  if (!isInfiniteWorksData(data)) return;
  const patched = patchWorkInInfiniteData(data, workId, listItem);
  if (patched) {
    queryClient.setQueryData(queryKey, patched);
  }
}

function isInactiveInfiniteListQuery(query: Query): boolean {
  return isInfiniteWorksData(query.state.data) && query.getObserversCount() === 0;
}

export async function staleInactiveListCaches(queryClient: QueryClient): Promise<void> {
  const predicate = (query: Query) => isInactiveInfiniteListQuery(query);

  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: WORK_QUERY_KEYS.all(),
      refetchType: "none",
      predicate,
    }),
    queryClient.invalidateQueries({
      queryKey: SMART_FOLDER_QUERY_KEYS.allWorks(),
      refetchType: "none",
      predicate,
    }),
  ]);
}
