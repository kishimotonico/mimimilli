import type { RouteTransition } from "../../../shared/model/routeStore";
import type { AppRoute } from "../../navigation/model/appRoute";
import { appRouteAction } from "../../navigation/model/appRouteStore";

/** 全画面作品詳細（/work/:id）へ遷移する。ライブラリ右ペイン・再生中の層どちらからも使う。 */
export function openWorkDetail(route: AppRoute, workId: string): RouteTransition<AppRoute> {
  return {
    route: {
      mode: "workDetail",
      workId,
      library: route.library,
      files: route.files,
      layer: route.layer,
    },
  };
}

export const openWorkDetailAtom = appRouteAction(openWorkDetail);
