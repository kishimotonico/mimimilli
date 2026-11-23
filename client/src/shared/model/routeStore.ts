// 型付きrouteの正本と書き込み口。route の項目を知らない汎用コードで、URLとの同期は
// useRouteHistorySync が持つ（ADR-0031）。
import { atom, type Atom, type WritableAtom } from "jotai";
import { atomWithLazy } from "jotai/utils";

export type HistoryWrite = "push" | "replace";
export type NavigationDirection = "forward" | "back";

export interface NavigateOptions {
  replace?: boolean;
  direction?: NavigationDirection;
}

export interface RouteTransition<R> extends NavigateOptions {
  route: R;
}

export type RouteUpdate<R> = R | ((current: R) => R);

export interface HistoryAvailability {
  canBack: boolean;
  canForward: boolean;
}

/** 履歴へ書く1回分の操作。URL と履歴エントリーの状態は route から codec が作る */
export interface PendingHistoryOp<R> {
  route: R;
  write: HistoryWrite;
}

export interface RouteStore<R> {
  routeAtom: Atom<R>;
  navigateAtom: WritableAtom<null, [next: RouteUpdate<R>, options?: NavigateOptions], void>;
  /** 現在のrouteから次の遷移を計算する純粋関数を、navigateを呼ぶwrite atomにする。null は何もしない */
  action: <A extends unknown[]>(
    compute: (current: R, ...args: A) => RouteTransition<R> | null,
  ) => WritableAtom<null, A, void>;
  directionAtom: Atom<NavigationDirection>;
  historyAvailabilityAtom: Atom<HistoryAvailability>;
  /** useRouteHistorySync 専用 */
  sync: {
    applyFromHistoryAtom: WritableAtom<
      null,
      [apply: (current: R) => R, direction: NavigationDirection],
      void
    >;
    /** navigate ごとの履歴操作を、まとめずに呼ばれた順で持つ */
    pendingOpsAtom: Atom<readonly PendingHistoryOp<R>[]>;
    /** 未反映の操作をすべて取り出して空にする */
    takePendingOpsAtom: WritableAtom<null, [], PendingHistoryOp<R>[]>;
    historyAvailabilityAtom: WritableAtom<HistoryAvailability, [HistoryAvailability], void>;
  };
}

export function createRouteStore<R>(readInitial: () => R): RouteStore<R> {
  const baseRouteAtom = atomWithLazy(readInitial);
  const NO_OPS: readonly PendingHistoryOp<R>[] = [];
  const pendingOpsAtom = atom<readonly PendingHistoryOp<R>[]>(NO_OPS);
  const directionAtom = atom<NavigationDirection>("forward");
  const historyAvailabilityAtom = atom<HistoryAvailability>({ canBack: false, canForward: false });

  const navigateAtom = atom(
    null,
    (get, set, next: RouteUpdate<R>, options: NavigateOptions = {}) => {
      const current = get(baseRouteAtom);
      const route = typeof next === "function" ? (next as (current: R) => R)(current) : next;
      if (route === current) return;
      const write: HistoryWrite = options.replace ? "replace" : "push";
      set(pendingOpsAtom, [...get(pendingOpsAtom), { route, write }]);
      set(directionAtom, options.direction ?? "forward");
      set(baseRouteAtom, route);
    },
  );

  return {
    routeAtom: atom((get) => get(baseRouteAtom)),
    navigateAtom,
    action: <A extends unknown[]>(compute: (current: R, ...args: A) => RouteTransition<R> | null) =>
      atom(null, (get, set, ...args: A) => {
        const transition = compute(get(baseRouteAtom), ...args);
        if (transition) set(navigateAtom, transition.route, transition);
      }),
    directionAtom: atom((get) => get(directionAtom)),
    historyAvailabilityAtom: atom((get) => get(historyAvailabilityAtom)),
    sync: {
      applyFromHistoryAtom: atom(
        null,
        (get, set, apply: (current: R) => R, direction: NavigationDirection) => {
          set(pendingOpsAtom, NO_OPS);
          set(directionAtom, direction);
          set(baseRouteAtom, apply(get(baseRouteAtom)));
        },
      ),
      pendingOpsAtom,
      takePendingOpsAtom: atom(null, (get, set) => {
        const ops = get(pendingOpsAtom);
        if (ops.length === 0) return [];
        set(pendingOpsAtom, NO_OPS);
        return [...ops];
      }),
      historyAvailabilityAtom,
    },
  };
}
