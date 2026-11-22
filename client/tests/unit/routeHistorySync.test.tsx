// 同期は route の項目を知らず、codec の parse/serialize だけでURLを扱う（ADR-0031）。
// 項目を1つ足した route 型と codec でも、同期のコードを変えずに同じ振る舞いになることを
// 両方の codec で同じシナリオを流して確認する。
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
      canonicalUrl: pageCodec.serialize(route).url,
      warnings: [],
      apply: (current) => ({ ...current, ...route }),
    };
  },
  serialize(route) {
    const params = new URLSearchParams();
    if (route.q) params.set("q", route.q);
    return { url: serializePath(route.page, params), entryState: undefined };
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
      canonicalUrl: pageWithLangCodec.serialize(route).url,
      warnings: [],
      apply: (current) => ({ ...current, ...route }),
    };
  },
  serialize(route) {
    const params = new URLSearchParams();
    if (route.q) params.set("q", route.q);
    if (route.lang !== "ja") params.set("lang", route.lang);
    return { url: serializePath(route.page, params), entryState: undefined };
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

  it("同じ描画の前に続けた push → push → replace は、呼ばれた順に push 2回と replace 1回で書く", () => {
    const { routeStore, store } = setup("/home");
    replaceState.mockClear();

    act(() => {
      store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "a" }));
      store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "b" }));
      store.set(routeStore.navigateAtom, (r) => ({ ...r, q: "x" }), { replace: true });
    });

    expect(currentUrl()).toBe("/b?q=x");
    expect(pushState).toHaveBeenCalledTimes(2);
    expect(replaceState).toHaveBeenCalledTimes(1);
  });

  it("元の route へ戻す navigate も、呼ばれた順に別の操作として書く", () => {
    const { routeStore, store } = setup("/home");
    const original = store.get(routeStore.routeAtom);

    act(() => {
      store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "other" }));
      store.set(routeStore.navigateAtom, original);
    });

    expect(currentUrl()).toBe("/home");
    expect(pushState).toHaveBeenCalledTimes(2);
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

interface NoteRoute extends PageRoute {
  note: string | null;
}

// URL に出さず履歴エントリーの状態へ書く項目を持つ codec
const noteCodec: RouteCodec<NoteRoute> = {
  parse(href, entryState) {
    const { url, page } = parsePath(href);
    const note =
      typeof entryState === "object" && entryState !== null && "note" in entryState
        ? (entryState.note as string | null)
        : null;
    return {
      canonicalUrl: noteCodec.serialize({ page, q: url.searchParams.get("q") ?? "", note }).url,
      warnings: [],
      apply: (current) => ({
        ...current,
        page,
        q: url.searchParams.get("q") ?? "",
        note: note ?? current.note,
      }),
    };
  },
  serialize(route) {
    const params = new URLSearchParams();
    if (route.q) params.set("q", route.q);
    return { url: serializePath(route.page, params), entryState: { note: route.note } };
  },
};

describe("useRouteHistorySync の履歴エントリーの状態", () => {
  function setupNote(url: string) {
    history.replaceState(null, "", url);
    const routeStore = createRouteStore<NoteRoute>(() =>
      noteCodec.parse(window.location.href, history.state?.__mimimilliRouteEntry).apply({
        page: "home",
        q: "",
        note: "fresh",
      }),
    );
    const store = mount(routeStore, noteCodec);
    return { routeStore, store };
  }

  function entryNote(): unknown {
    return history.state?.__mimimilliRouteEntry?.note;
  }

  it("状態の無い履歴エントリーを直接開いたら、置き換えで状態を書く", () => {
    const { routeStore, store } = setupNote("/home");

    expect(store.get(routeStore.routeAtom).note).toBe("fresh");
    expect(entryNote()).toBe("fresh");
    expect(pushState).not.toHaveBeenCalled();
  });

  it("URLが同じで状態だけ変わる push は、既定では置き換え、pushSameUrl なら積む", () => {
    const { routeStore, store } = setupNote("/home");
    pushState.mockClear();

    act(() => store.set(routeStore.navigateAtom, (r) => ({ ...r, note: "A" })));
    expect(entryNote()).toBe("A");
    expect(pushState).not.toHaveBeenCalled();

    act(() =>
      store.set(routeStore.navigateAtom, (r) => ({ ...r, note: "B" }), { pushSameUrl: true }),
    );
    expect(entryNote()).toBe("B");
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(store.get(routeStore.historyAvailabilityAtom).canBack).toBe(true);
  });

  it("push で新しいエントリーへ状態を書き、戻る・進むで元の値を読み戻す", () => {
    const { routeStore, store } = setupNote("/home");
    const stateHome = history.state;

    act(() => store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "a", note: "A" })));
    expect(entryNote()).toBe("A");
    expect(pushState).toHaveBeenCalledTimes(1);
    const stateA = history.state;

    const popWith = (url: string, state: unknown) => {
      history.replaceState(state, "", url);
      act(() => {
        window.dispatchEvent(new PopStateEvent("popstate", { state }));
      });
    };
    popWith("/home", stateHome);
    expect(store.get(routeStore.routeAtom)).toMatchObject({ page: "home", note: "fresh" });

    popWith("/a", stateA);
    expect(store.get(routeStore.routeAtom)).toMatchObject({ page: "a", note: "A" });
  });

  it("URLが同じで状態だけ変わったときは、pushせず置き換えで状態を書く", () => {
    const { routeStore, store } = setupNote("/home");
    pushState.mockClear();

    act(() => store.set(routeStore.navigateAtom, (r) => ({ ...r, note: "B" })));

    expect(pushState).not.toHaveBeenCalled();
    expect(entryNote()).toBe("B");
    expect(currentUrl()).toBe("/home");
  });
});

describe("useRouteHistorySync: 描画前に続けた操作の順序", () => {
  function setupNote(url: string) {
    history.replaceState(null, "", url);
    const routeStore = createRouteStore<NoteRoute>(() =>
      noteCodec.parse(window.location.href, history.state?.__mimimilliRouteEntry).apply({
        page: "home",
        q: "",
        note: "fresh",
      }),
    );
    return { routeStore, store: mount(routeStore, noteCodec) };
  }

  it("replace の直後、描画の前に push しても、前のエントリーに replace の内容が残る", () => {
    const { routeStore, store } = setupNote("/home");
    replaceState.mockClear();
    pushState.mockClear();

    act(() => {
      store.set(routeStore.navigateAtom, (r) => ({ ...r, note: "B" }), { replace: true });
      store.set(routeStore.navigateAtom, (r) => ({ ...r, page: "next", note: "N" }));
    });

    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState.mock.calls[0]?.[0]).toMatchObject({
      __mimimilliRouteEntry: { note: "B" },
    });
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(replaceState.mock.invocationCallOrder[0]).toBeLessThan(
      pushState.mock.invocationCallOrder[0]!,
    );
    expect(history.state.__mimimilliRouteEntry.note).toBe("N");
  });
});
