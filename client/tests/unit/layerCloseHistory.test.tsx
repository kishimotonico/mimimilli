// 層を開いている間の補正は、層を閉じて下のエントリーへ戻っても失われない（ADR-0041）。
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouteCodec, createInitialAppRoute } from "../../src/entities/navigation/model/appRoute";
import { addLibraryTag } from "../../src/entities/library/model/libraryRouteTransitions";
import { nt } from "../helpers/tag";
import { correctLibrary } from "../../src/entities/navigation/model/appRouteStore";
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
function popToBelow(seed: number, sort: string | null = null, url = BELOW_URL) {
  const state = {
    __mimimilliNavigation: { index: 0 },
    __mimimilliRouteEntry: { sort, groupSort: null, seed, layer: null },
  };
  history.replaceState(state, "", url);
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
        (route) => correctLibrary(route, { ...route.library, selectedTags: [], q: "" }).route,
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

  it("層で補正していなければ、層を閉じたあと下で変えた並びを、再訪した層の古い並びで書き戻さない", () => {
    const { routeStore, store } = setup();
    const seed = store.get(routeStore.routeAtom).library.seed;
    const openLayer = () =>
      store.set(routeStore.navigateAtom, (route) => ({
        ...route,
        layer: { kind: "nowPlaying", openedBy: "app" },
      }));

    act(openLayer);
    popToBelow(seed);
    // 下の一覧で並びを変える（replace）
    act(() =>
      store.set(
        routeStore.navigateAtom,
        (route) => ({ ...route, library: { ...route.library, sort: "title-asc" } }),
        { replace: true },
      ),
    );
    // 進むで層を再訪し、もう一度閉じる
    const layerState = {
      __mimimilliNavigation: { index: 1 },
      __mimimilliRouteEntry: {
        sort: null,
        groupSort: null,
        seed,
        layer: { kind: "nowPlaying", openedBy: "app" },
      },
    };
    history.replaceState(layerState, "", `${BELOW_URL}&np=1`);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: layerState }));
    });
    expect(store.get(routeStore.routeAtom).layer).not.toBeNull();

    popToBelow(seed, "title-asc");

    expect(store.get(routeStore.routeAtom)).toMatchObject({
      layer: null,
      library: { sort: "title-asc", selectedTags: ["ASMR"] },
    });
  });

  it("層で補正して引き継いだあとに下で並びを変え、層を再訪して閉じても、補正前の library を書き戻さない", () => {
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
        (route) => correctLibrary(route, { ...route.library, selectedTags: [], q: "" }).route,
        { replace: true },
      ),
    );
    const layerEntryState = (history.state as Record<string, unknown>).__mimimilliRouteEntry;
    popToBelow(seed);
    act(() =>
      store.set(
        routeStore.navigateAtom,
        (route) => ({ ...route, library: { ...route.library, sort: "title-asc" } }),
        { replace: true },
      ),
    );
    const layerState = {
      __mimimilliNavigation: { index: 1 },
      __mimimilliRouteEntry: layerEntryState,
    };
    history.replaceState(layerState, "", "/library/sf-own?np=1");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: layerState }));
    });

    popToBelow(seed, "title-asc", "/library/sf-own");

    expect(store.get(routeStore.routeAtom)).toMatchObject({
      layer: null,
      library: { sort: "title-asc", selectedTags: [], q: "" },
    });
  });

  it("再訪した層で2回目の補正をしても、閉じると最後の補正が残る（A→B のあと B→C）", () => {
    const { routeStore, store } = setup();
    const seed = store.get(routeStore.routeAtom).library.seed;
    const correct = (patch: object) =>
      act(() =>
        store.set(
          routeStore.navigateAtom,
          (route) => correctLibrary(route, { ...route.library, ...patch }).route,
          { replace: true },
        ),
      );
    act(() =>
      store.set(routeStore.navigateAtom, (route) => ({
        ...route,
        layer: { kind: "nowPlaying", openedBy: "app" },
      })),
    );
    correct({ q: "" });
    const layerEntryState = (history.state as Record<string, unknown>).__mimimilliRouteEntry;
    const layerUrl = currentUrl();

    // 閉じて（B が下へ反映される）、層を再訪する
    popToBelow(seed);
    const reflectedUrl = currentUrl();
    const layerState = {
      __mimimilliNavigation: { index: 1 },
      __mimimilliRouteEntry: layerEntryState,
    };
    history.replaceState(layerState, "", layerUrl);
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: layerState }));
    });
    correct({ selectedTags: [] });

    popToBelow(seed, null, reflectedUrl);

    expect(store.get(routeStore.routeAtom)).toMatchObject({
      layer: null,
      library: { selectedTags: [], q: "" },
    });
  });

  it("履歴から読んだ補正の印が不正なら無視し、通常の戻り先を使う", () => {
    const { routeStore, store } = setup();
    const seed = store.get(routeStore.routeAtom).library.seed;
    const library = store.get(routeStore.routeAtom).library;
    const { selectedTags: _omitted, ...broken } = library;
    const layerState = {
      __mimimilliNavigation: { index: 1 },
      __mimimilliRouteEntry: {
        sort: null,
        groupSort: null,
        seed,
        layer: {
          kind: "nowPlaying",
          openedBy: "app",
          carry: { from: library, to: { ...broken, q: "" } },
        },
      },
    };
    history.replaceState(layerState, "", `${BELOW_URL}&np=1`);

    expect(() =>
      act(() => {
        window.dispatchEvent(new PopStateEvent("popstate", { state: layerState }));
      }),
    ).not.toThrow();
    popToBelow(seed);

    expect(store.get(routeStore.routeAtom)).toMatchObject({
      layer: null,
      library: { selectedTags: ["ASMR"], q: "雨" },
    });
  });

  it("追加年→実タグの順に足したチップでも、層の補正を下へ引き継げる（メモリ上の並びが URL と同じ正準順）", () => {
    const { routeStore, store } = setup();
    for (const tag of [nt("@year/2024"), nt("cv/藤田茜")]) {
      act(() =>
        store.set(routeStore.navigateAtom, (route) => addLibraryTag(route, tag)?.route ?? route, {
          replace: true,
        }),
      );
    }
    const library = store.get(routeStore.routeAtom).library;
    expect(library.selectedTags).toEqual(["ASMR", "cv/藤田茜", "@year/2024"]);
    const belowUrl = currentUrl();
    act(() =>
      store.set(routeStore.navigateAtom, (route) => ({
        ...route,
        layer: { kind: "nowPlaying", openedBy: "app" },
      })),
    );
    act(() =>
      store.set(
        routeStore.navigateAtom,
        (route) => correctLibrary(route, { ...route.library, q: "補正" }).route,
        { replace: true },
      ),
    );

    popToBelow(library.seed, null, belowUrl);

    expect(store.get(routeStore.routeAtom).library).toMatchObject({
      selectedTags: ["ASMR", "cv/藤田茜", "@year/2024"],
      q: "補正",
    });
  });
});
