import { queryOptions, skipToken } from "@tanstack/react-query";
import { WORK_QUERY_KEYS } from "./queryKeys";
import { ApiRequestError } from "../../shared/api/http";
import { getWork } from "./api";

export function workDetailQueryOptions(workId: string | null) {
  return queryOptions({
    queryKey: WORK_QUERY_KEYS.detail(workId),
    queryFn: workId === null ? skipToken : () => getWork(workId),
    // 404 は作品が存在しない確定の応答。待たずに補正（選択解除・作品詳細からの退避）へ渡す
    retry: (failureCount, error) =>
      !(error instanceof ApiRequestError && error.status === 404) && failureCount < 1,
  });
}
