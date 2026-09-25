import { atom } from "jotai";
import { appRouteAtom } from "../../navigation/model/appRouteStore";

// 全画面作品詳細（/work/:id）で表示中の作品ID（entities/library の selectedWorkIdAtom とは独立）。
export const workDetailIdAtom = atom((get) => {
  const route = get(appRouteAtom);
  return route.mode === "workDetail" ? route.workId : null;
});
