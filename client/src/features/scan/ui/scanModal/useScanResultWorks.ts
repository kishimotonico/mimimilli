// 新規登録済み・更新された作品タブ共通: work ID列からタブ表示用の一覧を取得する。
import { useMemo } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import type { WorkListItem } from "@mimimilli/shared";
import { searchWorks } from "../../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../../entities/work/queryKeys";
import { apiErrorMessage } from "../../../../shared/lib/apiError";
import { orderByIds, sliceForDisplay } from "./scanResultWorkIds";

export interface ScanResultWorks {
  works: WorkListItem[];
  error: string | null;
  truncatedTotal: number | null;
  queryKey: QueryKey;
}

export function useScanResultWorks(workIds: string[], errorFallback: string): ScanResultWorks {
  const { visible, truncatedTotal } = useMemo(() => sliceForDisplay(workIds), [workIds]);
  const params = useMemo(() => ({ ids: visible }), [visible]);
  const queryKey = WORK_QUERY_KEYS.list(params);
  const query = useQuery({
    queryKey,
    queryFn: () => searchWorks(params),
    enabled: visible.length > 0,
  });
  const works = useMemo(() => orderByIds(query.data?.items ?? [], visible), [query.data, visible]);
  return {
    works,
    error: query.isError ? apiErrorMessage(query.error, errorFallback) : null,
    truncatedTotal,
    queryKey,
  };
}
