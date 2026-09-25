// root_reconfiguring（ADR-0029）検知の購読。shared/api/httpのドメイン非依存の
// onApiError購読口へ登録し、TanStack Queryを経由しない直接API呼び出し
// （await getParsed(...)等）でも同じ経路で拾う。マウント中だけ購読する
// （Providersから1回だけ呼ぶ想定。複数マウントで購読が重複しない）。
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { onApiError } from "../../shared/api/http";
import { SETTINGS_QUERY_KEYS } from "../../entities/settings/queryKeys";

export function useRootReconfiguringApiErrorHandler(
  client: QueryClient,
  /** 409を観測した＝他タブ等での再設定が関与した可能性があるため、離脱側後処理が
   *  必要な旨を呼び出し側（App層）へ伝える */
  onRootReconfiguring: () => void,
): void {
  useEffect(() => {
    return onApiError((error) => {
      if (error.code === "root_reconfiguring") {
        void client.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
        onRootReconfiguring();
      }
    });
  }, [client, onRootReconfiguring]);
}
