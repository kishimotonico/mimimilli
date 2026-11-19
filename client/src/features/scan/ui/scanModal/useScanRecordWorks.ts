// 新規作品・更新済みタブ共通: スキャンの記録に入っている作品を、スクロールに応じてページ単位で取得する。
import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ScanRecordKind, WorkChangeKind, WorkListItem } from "@mimimilli/shared";
import { searchWorks } from "../../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../../entities/work/queryKeys";
import { apiErrorMessage } from "../../../../shared/lib/apiError";

const SCAN_RECORD_PAGE_SIZE = 500;

export interface ScanRecordWorks {
  works: WorkListItem[];
  total: number;
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export function useScanRecordWorks(
  kind: ScanRecordKind,
  errorFallback: string,
  change?: WorkChangeKind,
): ScanRecordWorks {
  const params = useMemo(
    () => ({ scanRecord: kind, ...(change ? { scanChange: change } : {}) }),
    [kind, change],
  );
  const query = useInfiniteQuery({
    queryKey: [...WORK_QUERY_KEYS.list(params), "scanRecord"],
    queryFn: ({ pageParam }) =>
      searchWorks({ ...params, page: pageParam, limit: SCAN_RECORD_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < last.total ? pages.length + 1 : undefined;
    },
  });
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;

  const pages = query.data?.pages;
  return {
    works: useMemo(() => pages?.flatMap((page) => page.items) ?? [], [pages]),
    total: pages?.[pages.length - 1]?.total ?? 0,
    loading: query.isPending,
    error: isError ? apiErrorMessage(query.error, errorFallback) : null,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => void fetchNextPage(),
  };
}
