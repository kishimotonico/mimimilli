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
 *  await のあとに走っても画面と層を動かさないよう library だけを差し替え、履歴は常に置き換える */
export function appRouteCorrection<A extends unknown[]>(
  compute: (current: AppRoute, ...args: A) => LibraryRoute | null,
) {
  return appRouteStore.action((current: AppRoute, ...args: A) => {
    const library = compute(current, ...args);
    return library && correctLibrary(current, library);
  });
}

/** library だけを差し替える（履歴は置き換え）。層が開いていれば、層を閉じたときに下へ引き継げるよう、
 *  層を開いたときの library と補正後の library を層に持たせる */
export function correctLibrary(
  current: AppRoute,
  library: LibraryRoute,
): RouteTransition<AppRoute> {
  const layer = current.layer && {
    ...current.layer,
    carry: { from: current.layer.carry?.from ?? current.library, to: library },
  };
  return { route: { ...current, library, layer }, replace: true };
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
  return { route: { ...route, layer: { kind: "nowPlaying", openedBy: "app" } } };
}

export const openNowPlayingLayerAtom = appRouteStore.action(openNowPlayingLayer);

/** 層を閉じる。アプリの中で開いたなら履歴を1件戻り、それ以外は置き換えで np だけを外す。戻り先が無いときも置き換え */
export const closeLayerAtom = atom(null, (get, set) => {
  const { layer } = get(appRouteAtom);
  if (layer === null) return;
  if (layer.openedBy === "app" && get(navigationHistoryAvailabilityAtom).canBack) {
    navigationHistoryBack();
    return;
  }
  set(navigateAtom, (route) => ({ ...route, layer: null }), { replace: true });
});
