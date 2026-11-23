import { atom } from "jotai";
import { createRouteStore, type RouteTransition } from "../../../shared/model/routeStore";
import {
  navigationHistoryBack,
  readHistoryEntryState,
} from "../../../shared/model/useRouteHistorySync";
import {
  appRouteCodec,
  createInitialAppRoute,
  type AppMode,
  type AppRoute,
  type LibraryRoute,
  type SwitchableAppMode,
} from "./appRoute";

export const appRouteStore = createRouteStore<AppRoute>(() =>
  appRouteCodec
    .parse(window.location.href, readHistoryEntryState(window.history.state))
    .apply(createInitialAppRoute()),
);

export const appRouteAtom = appRouteStore.routeAtom;
export const navigateAtom = appRouteStore.navigateAtom;
export const navigationDirectionAtom = appRouteStore.directionAtom;
export const navigationHistoryAvailabilityAtom = appRouteStore.historyAvailabilityAtom;

/** 遷移: 画面へ進む操作は必ず層を落とす。層が開いているあいだの遷移は、層のエントリーを置き換える。
 *  層そのものを開く・閉じる操作はこの規則の外（appRouteStore.action を直接使う） */
export function appRouteAction<A extends unknown[]>(
  compute: (current: AppRoute, ...args: A) => RouteTransition<AppRoute> | null,
) {
  return appRouteStore.action((current: AppRoute, ...args: A) => {
    const transition = compute(current, ...args);
    if (!transition) return transition;
    const route = { ...transition.route, layer: null };
    return current.layer === null
      ? { ...transition, route }
      : { ...transition, route, replace: true };
  });
}

/** 補正: 開いている画面の library を事実に合わせ直す（選択解除・消えたフォルダーからの退避など）。
 *  await のあとに走っても画面と層を動かさないよう library だけを差し替え、履歴は常に置き換える。
 *  層が開いている間の補正は層のエントリーだけを書き換え、閉じた先には引き継がない */
export function appRouteCorrection<A extends unknown[]>(
  compute: (current: AppRoute, ...args: A) => LibraryRoute | null,
) {
  return appRouteStore.action((current: AppRoute, ...args: A) => {
    const library = compute(current, ...args);
    return library && { route: { ...current, library }, replace: true };
  });
}

export const appModeAtom = atom<AppMode>((get) => get(appRouteAtom).mode);

export function switchAppMode(
  route: AppRoute,
  mode: SwitchableAppMode,
): RouteTransition<AppRoute> | null {
  if (route.mode === mode) return null;
  return { route: { mode, library: route.library, files: route.files, layer: route.layer } };
}

export const setAppModeAtom = appRouteAction(switchAppMode);

/** 404・削除など、現在の画面自体が無効になったための強制退避で使う。履歴を積まず
 *  現在のエントリを置き換える（戻るで無効な画面へ戻ってpush→retreatを繰り返すのを防ぐ）。 */
export const replaceAppModeAtom = appRouteAction((route: AppRoute, mode: SwitchableAppMode) => {
  const transition = switchAppMode(route, mode);
  return transition && { ...transition, replace: true };
});

export const layerAtom = atom((get) => get(appRouteAtom).layer);

/** 再生中の層を今の画面に重ねる。履歴を1件積み、閉じるときに1件戻れるようにする */
export function openNowPlayingLayer(route: AppRoute): RouteTransition<AppRoute> | null {
  if (route.layer !== null) return null;
  return { route: { ...route, layer: { kind: "nowPlaying" } } };
}

export const openNowPlayingLayerAtom = appRouteStore.action(openNowPlayingLayer);

/** 戻る操作を始めたときの route。popstate で route が変わるまで、続けて閉じても2件戻らない */
const closingFromAtom = atom<AppRoute | null>(null);

/** 層を閉じる。戻れるなら履歴を1件戻り、戻り先が無ければ置き換えで層を外す */
export const closeLayerAtom = atom(null, (get, set) => {
  const route = get(appRouteAtom);
  if (route.layer === null || get(closingFromAtom) === route) return;
  if (get(navigationHistoryAvailabilityAtom).canBack) {
    set(closingFromAtom, route);
    navigationHistoryBack();
    return;
  }
  set(navigateAtom, (current) => ({ ...current, layer: null }), { replace: true });
});
