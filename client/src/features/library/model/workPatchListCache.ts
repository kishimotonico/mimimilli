// ブックマーク後、表示中の一覧 infinite query の該当行を直接書き換える。

import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import type { WorksPage } from "@mimimilli/shared";

function isInfiniteWorksData(data: unknown): data is InfiniteData<WorksPage> {
  return (
    typeof data === "object" &&
    data !== null &&
    "pages" in data &&
    Array.isArray((data as InfiniteData<WorksPage>).pages)
  );
}

export function patchBookmarkedInQueryCache(
  queryClient: QueryClient,
  queryKey: QueryKey,
  workId: string,
  bookmarked: boolean,
): void {
  const data = queryClient.getQueryData<InfiniteData<WorksPage>>(queryKey);
  if (!isInfiniteWorksData(data)) return;
  let changed = false;
  const pages = data.pages.map((page) => {
    const items = page.items.map((item) => {
      if (item.id !== workId || item.bookmarked === bookmarked) return item;
      changed = true;
      return { ...item, bookmarked };
    });
    return items === page.items ? page : { ...page, items };
  });
  if (changed) {
    queryClient.setQueryData(queryKey, { ...data, pages });
  }
}
