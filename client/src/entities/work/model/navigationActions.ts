import type { RouteTransition } from "../../../shared/model/routeStore";
import type { AppRoute } from "../../navigation/model/appRoute";
import { appRouteStore } from "../../navigation/model/appRouteStore";

/** 全画面作品詳細（/work/:id）へ遷移する。ライブラリ右ペイン・再生中タブどちらからも使う。 */
export function openWorkDetail(route: AppRoute, workId: string): RouteTransition<AppRoute> {
  return { route: { mode: "workDetail", workId, library: route.library, files: route.files } };
}

export const openWorkDetailAtom = appRouteStore.action(openWorkDetail);
