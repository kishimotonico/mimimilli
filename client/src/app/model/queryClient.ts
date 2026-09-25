// 共有QueryClientの生成。root_reconfiguring（ADR-0029）検知の購読はここでは
// 登録しない（ProvidersのuseEffectで行う）。ここではQueryClientを作るだけ。
import { QueryClient } from "@tanstack/react-query";
import { createBaseQueryClientOptions } from "../../shared/api/queryClient";

export function createQueryClient(): QueryClient {
  return new QueryClient(createBaseQueryClientOptions());
}

/** アプリ起動時に使う共有インスタンス。 */
export const queryClient = createQueryClient();
