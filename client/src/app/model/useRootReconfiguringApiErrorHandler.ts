// root_reconfiguring（ADR-0029）検知の購読。shared/api/httpのドメイン非依存の
// onApiError購読口へ登録し、TanStack Queryを経由しない直接API呼び出し
// （await getParsed(...)等）でも同じ経路で拾う。マウント中だけ購読する
// （Providersから1回だけ呼ぶ想定。複数マウントで購読が重複しない）。
//
// 409はロック中の合図であって離脱の合図ではない。ready中に409を離脱トリガー
// （epoch進行→resetQueries）にすると、resetQueriesで再取得したactiveクエリが
// まだロック中のAPIへ当たって再び409→また離脱トリガー…と、settings再取得で
// reconfiguring枝へ切り替わるまで空回りする。ここではsettingsのinvalidateだけ行い、
// 離脱側後処理はReconfigurationExitEffect（reconfiguring→readyの観測）と
// RootReconfigurationDriftEffect（rootFolder/completedAtの変化）に任せる。
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { onApiError } from "../../shared/api/http";
import { SETTINGS_QUERY_KEYS } from "../../entities/settings/queryKeys";

export function useRootReconfiguringApiErrorHandler(client: QueryClient): void {
  useEffect(() => {
    return onApiError((error) => {
      if (error.code === "root_reconfiguring") {
        void client.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
      }
    });
  }, [client]);
}
