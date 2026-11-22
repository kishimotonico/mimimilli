// routeとブラウザー履歴の同期。route の項目は codec の parse/serialize だけが知り、
// ここはURLと履歴エントリーの状態の比較とpush/replaceだけを受け持つ（ADR-0031・ADR-0041）。
import { useStore, useAtomValue } from "jotai";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { NavigationDirection, RouteStore } from "./routeStore";

export interface SerializedRoute {
  /** アドレスバーに出す部分 */
  url: string;
  /** 履歴エントリーに書く部分（structured clone できる値） */
  entryState: unknown;
}

export interface RouteParseResult<R> {
  canonicalUrl: string;
  warnings: string[];
  /** URLと履歴エントリーの状態が表す部分を現在のrouteへ重ねる */
  apply: (current: R) => R;
}

export interface RouteCodec<R> {
  /** entryState は履歴エントリーに書かれていた値。無ければ undefined */
  parse: (href: string, entryState: unknown) => RouteParseResult<R>;
  serialize: (route: R) => SerializedRoute;
}

const HISTORY_STATE_KEY = "__mimimilliNavigation";
const ENTRY_STATE_KEY = "__mimimilliRouteEntry";
const MAX_INDEX_KEY = "mimimilli.navigation.maxIndex";

function readMarkerIndex(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const marker = (state as Record<string, unknown>)[HISTORY_STATE_KEY];
  if (!marker || typeof marker !== "object") return null;
  const index = (marker as Record<string, unknown>).index;
  return typeof index === "number" && Number.isInteger(index) && index >= 0 ? index : null;
}

export function readHistoryEntryState(state: unknown): unknown {
  if (!state || typeof state !== "object") return undefined;
  return (state as Record<string, unknown>)[ENTRY_STATE_KEY];
}

function stateWithMarker(index: number, entryState?: unknown): Record<string, unknown> {
  const current = history.state;
  const base = current && typeof current === "object" ? (current as Record<string, unknown>) : {};
  const next = { ...base, [HISTORY_STATE_KEY]: { index } };
  return entryState === undefined ? next : { ...next, [ENTRY_STATE_KEY]: entryState };
}

function sameEntryState(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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

    const applyLocation = (
      index: number,
      alwaysMark: boolean,
      direction: NavigationDirection,
      state: unknown,
    ) => {
      const parsed = codec.parse(window.location.href, readHistoryEntryState(state));
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
      applyLocation(current, true, "forward", history.state);
    }

    const handlePopState = (event: PopStateEvent) => {
      const index = readMarkerIndex(event.state);
      const next = index ?? 0;
      const direction = next < indexRef.current ? "back" : "forward";
      moveTo(next, Math.max(maxIndexRef.current, readMaxIndex(next)));
      applyLocation(next, index === null, direction, event.state);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [codec, routeStore, store]);

  useEffect(() => {
    if (pendingWrite !== null) store.set(routeStore.sync.consumePendingWriteAtom);
    const { url: nextUrl, entryState } = codec.serialize(route);
    const urlChanged = nextUrl !== currentUrl();
    const stateChanged = !sameEntryState(readHistoryEntryState(history.state), entryState);
    if (!urlChanged && !stateChanged) return;

    if (pendingWrite === "push" && urlChanged) {
      const nextIndex = indexRef.current + 1;
      indexRef.current = nextIndex;
      maxIndexRef.current = nextIndex;
      writeMaxIndex(nextIndex);
      store.set(routeStore.sync.historyAvailabilityAtom, { canBack: true, canForward: false });
      history.pushState(stateWithMarker(nextIndex, entryState), "", nextUrl);
      return;
    }

    history.replaceState(stateWithMarker(indexRef.current, entryState), "", nextUrl);
  }, [codec, pendingWrite, route, routeStore, store]);
}
