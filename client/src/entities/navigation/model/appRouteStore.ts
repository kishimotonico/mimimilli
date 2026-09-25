import { atom } from "jotai";
import { createRouteStore, type RouteTransition } from "../../../shared/model/routeStore";
import {
  appRouteCodec,
  DEFAULT_APP_ROUTE,
  type AppMode,
  type AppRoute,
  type SwitchableAppMode,
} from "./appRoute";

export const appRouteStore = createRouteStore<AppRoute>(() =>
  appRouteCodec.parse(window.location.href).apply(DEFAULT_APP_ROUTE),
);

export const appRouteAtom = appRouteStore.routeAtom;
export const navigateAtom = appRouteStore.navigateAtom;
export const navigationDirectionAtom = appRouteStore.directionAtom;
export const navigationHistoryAvailabilityAtom = appRouteStore.historyAvailabilityAtom;

export const appModeAtom = atom<AppMode>((get) => get(appRouteAtom).mode);

export function switchAppMode(
  route: AppRoute,
  mode: SwitchableAppMode,
): RouteTransition<AppRoute> | null {
  if (route.mode === mode) return null;
  return { route: { mode, library: route.library, files: route.files } };
}

export const setAppModeAtom = appRouteStore.action(switchAppMode);

/** 404・削除など、現在の画面自体が無効になったための強制退避で使う。履歴を積まず
 *  現在のエントリを置き換える（戻るで無効な画面へ戻ってpush→retreatを繰り返すのを防ぐ）。 */
export const replaceAppModeAtom = appRouteStore.action(
  (route: AppRoute, mode: SwitchableAppMode) => {
    const transition = switchAppMode(route, mode);
    return transition && { ...transition, replace: true };
  },
);
