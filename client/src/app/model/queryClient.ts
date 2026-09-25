// 共有QueryClientの生成。root_reconfiguring（ADR-0029）検知だけはドメイン知識なのでここで組み込む。
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createBaseQueryClientOptions } from "../../shared/api/queryClient";
import { ApiRequestError } from "../../shared/api/http";
import { SETTINGS_QUERY_KEYS } from "../../entities/settings/queryKeys";

export function createQueryClient(): QueryClient {
  const handleApiError = (error: unknown): void => {
    if (error instanceof ApiRequestError && error.code === "root_reconfiguring") {
      void client.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
    }
  };

  const client: QueryClient = new QueryClient({
    ...createBaseQueryClientOptions(),
    queryCache: new QueryCache({ onError: handleApiError }),
    mutationCache: new MutationCache({ onError: handleApiError }),
  });

  return client;
}

/** アプリ起動時に使う共有インスタンス。 */
export const queryClient = createQueryClient();
