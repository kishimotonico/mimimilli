// 層は履歴エントリーの状態にだけ持つ。開くと積み、層の間の補正は層のエントリーだけを書き換える（ADR-0041）。
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouteCodec, createInitialAppRoute } from "../../src/entities/navigation/model/appRoute";
import { createRouteStore } from "../../src/shared/model/routeStore";
import { useRouteHistorySync } from "../../src/shared/model/useRouteHistorySync";

const initialUrl = `${window.location.pathname}${window.location.search}`;
const BELOW_URL = "/library/sf-own?tags=ASMR&q=%E9%9B%A8";

function currentUrl(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function setup(initialState: unknown = null, url = BELOW_URL) {
  history.replaceState(initialState, "", url);
  const routeStore = createRouteStore(() =>
    appRouteCodec
      .parse(window.location.href, history.state?.__mimimilliRouteEntry)
      .apply(createInitialAppRoute()),
  );
  const store = createStore();
  function Sync() {
    useRouteHistorySync(routeStore, appRouteCodec);
    return null;
  }
  render(createElement(Provider, { store }, createElement(Sync)));
  return { routeStore, store };
}

/** 下のエントリー（index 0）へ戻る popstate。エントリーの状態は層を開く前に書かれたもの */
function popToBelow(seed: number) {
  const state = {
    __mimimilliNavigation: { index: 0 },
    __mimimilliRouteEntry: { sort: null, groupSort: null, seed, layer: null },
  };
  history.replaceState(state, "", BELOW_URL);
  (history.replaceState as { mockClear?: () => void }).mockClear?.();
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
  });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  history.replaceState(null, "", initialUrl);
});

describe("層の履歴エントリー", () => {
  const openLayer = (
    routeStore: ReturnType<typeof setup>["routeStore"],
    store: ReturnType<typeof createStore>,
  ) =>
    act(() =>
      store.set(routeStore.navigateAtom, (route) => ({
        ...route,
        layer: { kind: "nowPlaying" },
      })),
    );

  it("開くと URL は変わらず履歴が1件増え、層は履歴エントリーの状態に書かれる", () => {
    const { routeStore, store } = setup();
    const pushState = vi.spyOn(history, "pushState");

    openLayer(routeStore, store);

    expect(pushState).toHaveBeenCalledTimes(1);
    expect(currentUrl()).toBe(BELOW_URL);
    expect(history.state.__mimimilliRouteEntry.layer).toEqual({ kind: "nowPlaying" });
    expect(store.get(routeStore.historyAvailabilityAtom).canBack).toBe(true);
  });

  it("層を持つエントリーを開き直す（再読み込み・進む）と、層つきで着く", () => {
    const layerState = {
      __mimimilliNavigation: { index: 1 },
      __mimimilliRouteEntry: {
        sort: null,
        groupSort: null,
        seed: 1,
        layer: { kind: "nowPlaying" },
      },
    };
    const { routeStore, store } = setup(layerState);

    expect(store.get(routeStore.routeAtom)).toMatchObject({
      layer: { kind: "nowPlaying" },
      library: { folderId: "sf-own", selectedTags: ["ASMR"], q: "雨" },
    });
    expect(currentUrl()).toBe(BELOW_URL);
  });

  it("層を開いている間の補正は層のエントリーだけを書き換え、閉じた先の library には引き継がない", () => {
    const { routeStore, store } = setup();
    const seed = store.get(routeStore.routeAtom).library.seed;
    openLayer(routeStore, store);
    act(() =>
      store.set(
        routeStore.navigateAtom,
        (route) => ({ ...route, library: { ...route.library, selectedTags: [], q: "" } }),
        { replace: true },
      ),
    );
    expect(currentUrl()).toBe("/library/sf-own");
    expect(history.state.__mimimilliRouteEntry.layer).toEqual({ kind: "nowPlaying" });

    popToBelow(seed);

    expect(store.get(routeStore.routeAtom)).toMatchObject({
      layer: null,
      library: { folderId: "sf-own", selectedTags: ["ASMR"], q: "雨" },
    });
    expect(currentUrl()).toBe(BELOW_URL);
  });

  it("補正が無ければ戻った先をそのまま復元し、履歴へ余計に書かない", () => {
    const { routeStore, store } = setup();
    const seed = store.get(routeStore.routeAtom).library.seed;
    openLayer(routeStore, store);
    const replaceState = vi.spyOn(history, "replaceState");

    popToBelow(seed);

    expect(store.get(routeStore.routeAtom)).toMatchObject({
      layer: null,
      library: { folderId: "sf-own", selectedTags: ["ASMR"], q: "雨" },
    });
    expect(replaceState).not.toHaveBeenCalled();
  });
});
