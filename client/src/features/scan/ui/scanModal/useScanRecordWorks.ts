// 新規作品・更新済みタブ共通: スキャンの記録に入っている作品を、スクロールに応じてページ単位で取得する。
import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { ScanRecord, ScanRecordKind, WorkChangeKind, WorkListItem } from "@mimimilli/shared";
import { scanRecordQueryOptions } from "../../../../entities/scan/queryOptions";
import { getAllWorks } from "../../../../entities/smart-folder/api";
import { WORK_QUERY_KEYS } from "../../../../entities/work/queryKeys";
import { deriveScanListStatus, type ScanListStatus } from "../../model/scanListStatus";

const SCAN_RECORD_PAGE_SIZE = 500;

export interface ScanRecordWorks {
  works: WorkListItem[];
  /** 今の条件に合う作品の件数 */
  total: number;
  /** 遅延表示を反映する前の一覧の状態 */
  status: ScanListStatus;
  retry: () => void;
  /** 取得済みの行は残したまま、次のページの取得だけが失敗している。取り直している間は出さない */
  nextPageError: boolean;
  retryNextPage: () => void;
  /** useVirtualList へ渡す。次ページの取得が失敗しているあいだは続きがないものとして自動取得を止める */
  infiniteScroll: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onLoadMore: () => void;
  };
}

/** 「新規作品」は条件がないので、一覧が空かどうかは取得した件数で決まる。「更新済み」は種類で絞るので記録の件数で決まる。 */
function recordCount(kind: ScanRecordKind, record: ScanRecord | undefined, total: number) {
  return kind === "updated" ? (record?.updatedWorks.length ?? 0) : total;
}

export function useScanRecordWorks(kind: ScanRecordKind, change?: WorkChangeKind): ScanRecordWorks {
  const recordQuery = useQuery(scanRecordQueryOptions);
  const params = useMemo(
    () => ({ scanRecord: kind, ...(change ? { scanChange: change } : {}) }),
    [kind, change],
  );
  const query = useInfiniteQuery({
    queryKey: [...WORK_QUERY_KEYS.list(params), "scanRecord"],
    queryFn: ({ pageParam }) =>
      getAllWorks({ ...params, page: pageParam, limit: SCAN_RECORD_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < last.total ? pages.length + 1 : undefined;
    },
  });
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, isError, fetchNextPage, refetch } =
    query;

  const pages = query.data?.pages;
  const total = pages?.[pages.length - 1]?.total ?? 0;
  const worksError = isError && pages === undefined;
  const status = deriveScanListStatus({
    loading: query.isPending || recordQuery.isPending,
    error: worksError || (recordQuery.isError && recordQuery.data === undefined),
    notScanned: recordQuery.data?.finishedAt === null,
    count: recordCount(kind, recordQuery.data, total),
  });
  const retry = () => {
    if (recordQuery.isError) void recordQuery.refetch();
    if (worksError) void refetch();
  };

  return {
    works: useMemo(() => pages?.flatMap((page) => page.items) ?? [], [pages]),
    total,
    status,
    retry,
    nextPageError: isFetchNextPageError && !isFetchingNextPage,
    retryNextPage: () => void fetchNextPage(),
    infiniteScroll: {
      hasNextPage: hasNextPage && !isFetchNextPageError,
      isFetchingNextPage,
      onLoadMore: () => void fetchNextPage(),
    },
  };
}
