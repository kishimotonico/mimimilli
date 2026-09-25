// 共有QueryClientの生成。root_reconfiguring（ADR-0029）検知はshared/api/httpの
// ドメイン非依存のonApiError購読口へ登録する（QueryCache/MutationCacheを経由しない
// 直接API呼び出しでも同じ経路で拾うため）。
import { QueryClient } from "@tanstack/react-query";
import { createBaseQueryClientOptions } from "../../shared/api/queryClient";
import { onApiError } from "../../shared/api/http";
import { SETTINGS_QUERY_KEYS } from "../../entities/settings/queryKeys";

export function createQueryClient(): QueryClient {
  const client = new QueryClient(createBaseQueryClientOptions());

  onApiError((error) => {
    if (error.code === "root_reconfiguring") {
      void client.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
    }
  });

  return client;
}

/** アプリ起動時に使う共有インスタンス。 */
export const queryClient = createQueryClient();
