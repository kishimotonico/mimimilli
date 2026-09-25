// 共有QueryClientの生成。root_reconfiguring（ADR-0029）検知はshared/api/httpの
// ドメイン非依存のonApiError購読口へ登録する（QueryCache/MutationCacheを経由しない
// 直接API呼び出しでも同じ経路で拾うため）。
import { QueryClient } from "@tanstack/react-query";
import { createBaseQueryClientOptions } from "../../shared/api/queryClient";
import { onApiError } from "../../shared/api/http";
import { SETTINGS_QUERY_KEYS } from "../../entities/settings/queryKeys";

// createQueryClientは通常アプリで一度だけ呼ぶが、テストでは複数回呼ばれる。
// 呼ぶたびに前回分の購読を解除し、shared/api/httpのapiErrorListenersにリスナーが
// 溜まり続けないようにする。
let unsubscribePreviousApiErrorListener: (() => void) | null = null;

export function createQueryClient(): QueryClient {
  unsubscribePreviousApiErrorListener?.();

  const client = new QueryClient(createBaseQueryClientOptions());

  unsubscribePreviousApiErrorListener = onApiError((error) => {
    if (error.code === "root_reconfiguring") {
      void client.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
    }
  });

  return client;
}

/** アプリ起動時に使う共有インスタンス。 */
export const queryClient = createQueryClient();
