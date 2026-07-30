import type { DlsiteNotificationItem, DlsiteNotificationKind } from "@mimimilli/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { queryDlsiteNotifications } from "../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { useDlsiteNotificationSummary } from "./useDlsiteNotificationSummary";

const NOTIFICATION_PAGE_SIZE = 100;

const SUMMARY_COUNT_KEY = {
  "rj-missing": "rjCodeMissingCount",
  "fetch-failed": "fetchFailedCount",
  "parse-failed": "parseErrorCount",
} as const satisfies Record<
  DlsiteNotificationKind,
  keyof ReturnType<typeof useDlsiteNotificationSummary>
>;

export function useDlsiteNotificationList(kind: DlsiteNotificationKind) {
  const summary = useDlsiteNotificationSummary();
  const list = useInfiniteQuery({
    queryKey: WORK_QUERY_KEYS.dlsiteNotificationList(kind),
    queryFn: ({ pageParam }) =>
      queryDlsiteNotifications(kind, { page: pageParam, limit: NOTIFICATION_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < last.total ? pages.length + 1 : undefined;
    },
  });

  const countKey = SUMMARY_COUNT_KEY[kind];
  const count = summary[countKey];
  const listTotal = list.data?.pages[list.data.pages.length - 1]?.total;
  const works: DlsiteNotificationItem[] = list.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    works,
    count,
    ...(kind === "parse-failed" ? { alert: summary.parseErrorAlert } : {}),
    total: listTotal ?? count,
    isLoading: summary.isLoading || list.isPending,
    hasNextPage: list.hasNextPage ?? false,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: list.fetchNextPage,
  };
}
