import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  getDlsiteNotificationSummary,
  queryDlsiteParseFailedNotifications,
} from "../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";

const NOTIFICATION_PAGE_SIZE = 100;

export function useDlsiteParseFailedWorks() {
  const summary = useQuery({
    queryKey: WORK_QUERY_KEYS.dlsiteNotificationSummary(),
    queryFn: getDlsiteNotificationSummary,
  });
  const list = useInfiniteQuery({
    queryKey: WORK_QUERY_KEYS.dlsiteNotificationList("parse-failed"),
    queryFn: ({ pageParam }) =>
      queryDlsiteParseFailedNotifications({ page: pageParam, limit: NOTIFICATION_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < last.total ? pages.length + 1 : undefined;
    },
  });
  const listTotal = list.data?.pages[list.data.pages.length - 1]?.total;
  return {
    works: list.data?.pages.flatMap((page) => page.items) ?? [],
    count: summary.data?.parseErrorCount ?? 0,
    alert: summary.data?.parseErrorAlert ?? false,
    total: listTotal ?? summary.data?.parseErrorCount ?? 0,
    isLoading: summary.isPending || list.isPending,
    hasNextPage: list.hasNextPage ?? false,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: list.fetchNextPage,
  };
}
