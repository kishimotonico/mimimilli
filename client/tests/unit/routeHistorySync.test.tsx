// 同期は route の項目を知らず、codec の parse/serialize だけでURLを扱う（ADR-0031）。
// 項目を1つ足した route 型と codec でも、同期のコードを変えずに同じ振る舞いになることを
// 両方の codec で同じシナリオを流して確認する（TASK-466 AC#5）。
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRouteStore, type RouteStore } from "../../src/shared/model/routeStore";
import { useRouteHistorySync, type RouteCodec } from "../../src/shared/model/useRouteHistorySync";

interface PageRoute {
  page: string;
  q: string;
}

interface PageRouteWithLang extends PageRoute {
  lang: string;
}

function parsePath(href: string) {
  const url = new URL(href, "http://test.local");
  const page = url.pathname.replace(/^\/+/, "") || "home";
  return { url, page };
}

function serializePath(page: string, params: URLSearchParams): string {
  const search = params.toString();
  return search ? `/${page}?${search}` : `/${page}`;
}

const pageCodec: RouteCodec<PageRoute> = {
  parse(href) {
    const { url, page } = parsePath(href);
    const route = { page, q: url.searchParams.get("q") ?? "" };
    return {
      canonicalUrl: pageCodec.serialize(route),
      warnings: [],
      apply: (current) => ({ ...current, ...route }),
    };
  },
  serialize(route) {
    const params = new URLSearchParams();
    if (route.q) params.set("q", route.q);
    return serializePath(route.page, params);
  },
};

const pageWithLangCodec: RouteCodec<PageRouteWithLang> = {
  parse(href) {
    const { url, page } = parsePath(href);
    const route = {
      page,
      q: url.searchParams.get("q") ?? "",
      lang: url.searchParams.get("lang") ?? "ja",
    };
    return {
      canonicalUrl: pageWithLangCodec.serialize(route),
      warnings: [],
      apply: (current) => ({ ...current, ...route }),
    };
  },
  serialize(route) {
    const params = new URLSearchParams();
    if (route.q) params.set("q", route.q);
    if (route.lang !== "ja") params.set("lang", route.lang);
    return serializePath(route.page, params);
  },
};

interface Scenario<R extends PageRoute> {
  name: string;
  codec: RouteCodec<R>;
  initial: R;
}

const scenarios: [Scenario<PageRoute>, Scenario<PageRouteWithLang>] = [
  { name: "page・q の route", codec: pageCodec, initial: { page: "home", q: "" } },
  {
    name: "lang を足した route",
    codec: pageWithLangCodec,
    initial: { page: "home", q: "", lang: "ja" },
  },
];

const initialUrl = `${window.location.pathname}${window.location.search}`;

function currentUrl(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function mount<R>(routeStore: RouteStore<R>, codec: RouteCodec<R>) {
  const store = createStore();
  function Sync() {
    useRouteHistorySync(routeStore, codec);
    return null;
  }
  render(createElement(Provider, { store }, createElement(Sync)));
  return store;
}

function popTo(url: string, index: number | null) {
  const state = index === null ? null : { __mimimilliNavigation: { index } };
  history.replaceState(state, "", url);
  vi.mocked(history.replaceState).mockClear();
  vi.mocked(history.pushState).mockClear();
  act(() => {
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
  });
}

let pushState: ReturnType<typeof vi.spyOn>;
let replaceState: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  sessionStorage.clear();
  history.replaceState(null, "", "/");
  pushState = vi.spyOn(history, "pushState");
  replaceState = vi.spyOn(history, "replaceState");
});

afterEach(() => {
  vi.restoreAllMocks();
  history.replaceState(null, "", initialUrl);
});

describe.each(scenarios)("useRouteHistorySync（$name）", ({ codec, initial }) => {
  function setup(url: string) {
    history.replaceState(null, "", url);
    replaceState.mockClear();
    const routeStore = createRouteStore(() => codec.parse(window.location.href).apply(initial));
    const store = mount(routeStore, codec);
    return { routeStore, store };
  }

  it("初回ロードは正規形へ replace 1回だけで、履歴を積まない", () => {
    setup("/search?unknown=1&q=abc");

    expect(currentUrl()).toBe("/search?q=abc");
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(pushState).not.toHaveBeenCalled();
  });

  it("navigate は既定で push、replace 指定で置き換える", () => {
    const { routeStore, store } = setup("/home");

    act(() => store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "list" })));
    expect(currentUrl()).toBe("/list");
    expect(pushState).toHaveBeenCalledTimes(1);

    replaceState.mockClear();
    act(() => store.set(routeStore.navigateAtom, (r) => ({ ...r, q: "x" }), { replace: true }));
    expect(currentUrl()).toBe("/list?q=x");
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(store.get(routeStore.historyAvailabilityAtom)).toEqual({
      canBack: true,
      canForward: false,
    });
  });

  it("同期がURLへ書くまでの push → push → replace は push 1回にまとまる", () => {
    const { routeStore, store } = setup("/home");

    act(() => {
      store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "a" }));
      store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "b" }));
      store.set(routeStore.navigateAtom, (r) => ({ ...r, q: "x" }), { replace: true });
    });

    expect(currentUrl()).toBe("/b?q=x");
    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it("同一バッチで元の route へ戻したあとの replace は push にならない", () => {
    const { routeStore, store } = setup("/home");
    const original = store.get(routeStore.routeAtom);

    act(() => {
      store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "other" }));
      store.set(routeStore.navigateAtom, original);
    });
    act(() => store.set(routeStore.navigateAtom, (r) => ({ ...r, q: "x" }), { replace: true }));

    expect(currentUrl()).toBe("/home?q=x");
    expect(pushState).not.toHaveBeenCalled();
  });

  it("URLが変わらない route の変更は履歴へ書かない", () => {
    const { routeStore, store } = setup("/home");
    replaceState.mockClear();

    act(() => store.set(routeStore.navigateAtom, (r) => ({ ...r })));

    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("popstate は route へ適用するだけで履歴へ書かない", () => {
    const { routeStore, store } = setup("/home");
    act(() => store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "list", q: "x" })));

    popTo("/home", 0);

    expect(store.get(routeStore.routeAtom)).toMatchObject({ page: "home", q: "" });
    expect(currentUrl()).toBe("/home");
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("非正規形のURLへ戻ったら正規形へ replace 1回だけ", () => {
    const { routeStore, store } = setup("/home");

    popTo("/list?junk=1&q=x", 0);

    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(currentUrl()).toBe("/list?q=x");
    expect(store.get(routeStore.routeAtom)).toMatchObject({ page: "list", q: "x" });
    expect(pushState).not.toHaveBeenCalled();
  });

  it("popstate の履歴 index から遷移の向きと戻る/進むの可否を決める", () => {
    const { routeStore, store } = setup("/home");
    act(() => store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "a" })));
    act(() => store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "b" })));
    expect(store.get(routeStore.directionAtom)).toBe("forward");

    popTo("/a", 1);
    expect(store.get(routeStore.directionAtom)).toBe("back");
    expect(store.get(routeStore.historyAvailabilityAtom)).toEqual({
      canBack: true,
      canForward: true,
    });

    popTo("/b", 2);
    expect(store.get(routeStore.directionAtom)).toBe("forward");
  });

  it("navigate の direction を遷移の向きとして公開し、省略時は forward に戻る", () => {
    const { routeStore, store } = setup("/home");

    act(() =>
      store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "up" }), { direction: "back" }),
    );
    expect(store.get(routeStore.directionAtom)).toBe("back");

    act(() => store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "down" })));
    expect(store.get(routeStore.directionAtom)).toBe("forward");
  });
});

describe("useRouteHistorySync の項目追加", () => {
  it("足した項目も codec の serialize どおりにURLへ出る", () => {
    history.replaceState(null, "", "/home?lang=en");
    const routeStore = createRouteStore(() =>
      pageWithLangCodec.parse(window.location.href).apply({ page: "home", q: "", lang: "ja" }),
    );
    const store = mount(routeStore, pageWithLangCodec);
    expect(store.get(routeStore.routeAtom).lang).toBe("en");

    act(() => store.set(routeStore.navigateAtom, (r) => ({ ...r, lang: "ja" }), { replace: true }));

    expect(currentUrl()).toBe("/home");
  });
});
