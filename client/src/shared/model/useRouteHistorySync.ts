// routeとブラウザー履歴の同期。route の項目は codec の parse/serialize だけが知り、
// ここはURL文字列の比較とpush/replaceだけを受け持つ（ADR-0031）。
import { useStore, useAtomValue } from "jotai";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { NavigationDirection, RouteStore } from "./routeStore";

export interface RouteParseResult<R> {
  canonicalUrl: string;
  warnings: string[];
  /** URLが表す部分を現在のrouteへ重ねる */
  apply: (current: R) => R;
}

export interface RouteCodec<R> {
  parse: (href: string) => RouteParseResult<R>;
  serialize: (route: R) => string;
}

const HISTORY_STATE_KEY = "__mimimilliNavigation";
const MAX_INDEX_KEY = "mimimilli.navigation.maxIndex";

function readMarkerIndex(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const marker = (state as Record<string, unknown>)[HISTORY_STATE_KEY];
  if (!marker || typeof marker !== "object") return null;
  const index = (marker as Record<string, unknown>).index;
  return typeof index === "number" && Number.isInteger(index) && index >= 0 ? index : null;
}

function stateWithMarker(index: number): Record<string, unknown> {
  const current = history.state;
  const base = current && typeof current === "object" ? (current as Record<string, unknown>) : {};
  return { ...base, [HISTORY_STATE_KEY]: { index } };
}

function readMaxIndex(currentIndex: number): number {
  const stored = Number.parseInt(sessionStorage.getItem(MAX_INDEX_KEY) ?? "", 10);
  return Number.isInteger(stored) && stored >= currentIndex ? stored : currentIndex;
}

function writeMaxIndex(index: number): void {
  sessionStorage.setItem(MAX_INDEX_KEY, String(index));
}

function currentUrl(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function navigationHistoryBack(): void {
  window.history.back();
}

export function navigationHistoryForward(): void {
  window.history.forward();
}

export function useRouteHistorySync<R>(routeStore: RouteStore<R>, codec: RouteCodec<R>): void {
  const store = useStore();
  const route = useAtomValue(routeStore.routeAtom);
  // route が元の値へ戻ったバッチでも、未反映の書き込み要求を必ず消化する
  const pendingWrite = useAtomValue(routeStore.sync.pendingWriteAtom);
  const indexRef = useRef(0);
  const maxIndexRef = useRef(0);
  const initializedRef = useRef(false);

  useLayoutEffect(() => {
    const { sync } = routeStore;

    const moveTo = (index: number, maxIndex: number) => {
      indexRef.current = index;
      maxIndexRef.current = maxIndex;
      writeMaxIndex(maxIndex);
      store.set(sync.historyAvailabilityAtom, {
        canBack: index > 0,
        canForward: index < maxIndex,
      });
    };

    const applyLocation = (index: number, alwaysMark: boolean, direction: NavigationDirection) => {
      const parsed = codec.parse(window.location.href);
      for (const warning of parsed.warnings) console.warn(`[navigation] ${warning}`);
      if (alwaysMark || parsed.canonicalUrl !== currentUrl()) {
        history.replaceState(stateWithMarker(index), "", parsed.canonicalUrl);
      }
      store.set(sync.applyFromHistoryAtom, parsed.apply, direction);
    };

    if (!initializedRef.current) {
      initializedRef.current = true;
      const index = readMarkerIndex(history.state);
      const current = index ?? 0;
      moveTo(current, index === null ? current : readMaxIndex(current));
      applyLocation(current, true, "forward");
    }

    const handlePopState = (event: PopStateEvent) => {
      const index = readMarkerIndex(event.state);
      const next = index ?? 0;
      const direction = next < indexRef.current ? "back" : "forward";
      moveTo(next, Math.max(maxIndexRef.current, readMaxIndex(next)));
      applyLocation(next, index === null, direction);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [codec, routeStore, store]);

  useEffect(() => {
    if (pendingWrite !== null) store.set(routeStore.sync.consumePendingWriteAtom);
    const nextUrl = codec.serialize(route);
    if (nextUrl === currentUrl()) return;

    if (pendingWrite === "push") {
      const nextIndex = indexRef.current + 1;
      indexRef.current = nextIndex;
      maxIndexRef.current = nextIndex;
      writeMaxIndex(nextIndex);
      store.set(routeStore.sync.historyAvailabilityAtom, { canBack: true, canForward: false });
      history.pushState(stateWithMarker(nextIndex), "", nextUrl);
      return;
    }

    history.replaceState(stateWithMarker(indexRef.current), "", nextUrl);
  }, [codec, pendingWrite, route, routeStore, store]);
}
