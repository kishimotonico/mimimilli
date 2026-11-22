// 層を開いている間の補正は、層を閉じて下のエントリーへ戻っても失われない（ADR-0041）。
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

function setup() {
  history.replaceState(null, "", BELOW_URL);
  const routeStore = createRouteStore(() =>
    appRouteCodec.parse(window.location.href, undefined).apply(createInitialAppRoute()),
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

describe("層を閉じて下のエントリーへ戻る", () => {
  it("層を開いている間の補正（チップ・検索語を外す）が、戻った先にも残る", () => {
    const { routeStore, store } = setup();
    const seed = store.get(routeStore.routeAtom).library.seed;

    act(() =>
      store.set(routeStore.navigateAtom, (route) => ({
        ...route,
        layer: { kind: "nowPlaying", openedBy: "app" },
      })),
    );
    act(() =>
      store.set(
        routeStore.navigateAtom,
        (route) => ({ ...route, library: { ...route.library, selectedTags: [], q: "" } }),
        { replace: true },
      ),
    );
    expect(currentUrl()).toBe("/library/sf-own?np=1");

    popToBelow(seed);

    expect(store.get(routeStore.routeAtom)).toMatchObject({
      layer: null,
      library: { folderId: "sf-own", selectedTags: [], q: "" },
    });
    expect(currentUrl()).toBe("/library/sf-own");
  });

  it("補正が無ければ戻った先をそのまま復元し、履歴へ余計に書かない", () => {
    const { routeStore, store } = setup();
    const seed = store.get(routeStore.routeAtom).library.seed;
    act(() =>
      store.set(routeStore.navigateAtom, (route) => ({
        ...route,
        layer: { kind: "nowPlaying", openedBy: "app" },
      })),
    );
    const replaceState = vi.spyOn(history, "replaceState");

    popToBelow(seed);
    expect(store.get(routeStore.routeAtom)).toMatchObject({
      layer: null,
      library: { folderId: "sf-own", selectedTags: ["ASMR"], q: "雨" },
    });
    expect(currentUrl()).toBe(BELOW_URL);
    expect(replaceState).not.toHaveBeenCalled();
  });
});
