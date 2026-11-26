import { act, cleanup, render } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { afterEach, describe, expect, it } from "vitest";
import { focusListOnReturnAtom } from "../../src/features/library/model/focusListOnReturnAtom";
import { useFocusListOnReturn } from "../../src/features/library/ui/useFocusListOnReturn";
import { focusListAfterRemoval } from "../../src/features/library/ui/focusListEntry";
import { deselectLibraryWorkIfSelected } from "../../src/entities/library/model/libraryRouteTransitions";
import type { AppRoute } from "../../src/entities/navigation/model/appRoute";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function list(ids: string[]) {
  document.body.innerHTML = `<div data-work-list ${ids.length === 0 ? 'tabindex="-1"' : ""}>${ids
    .map(
      (id, index) =>
        `<button data-work-id="${id}" tabindex="${index === 0 ? 0 : -1}">${id}</button>`,
    )
    .join(
      "",
    )}</div><div id="detail"><button id="more">more</button></div><button id="other">other</button>`;
}

describe("登録解除後のフォーカス", () => {
  it("フォーカスが失われていれば、隣の行が無いとき roving の行へ、空ならコンテナへ移す", () => {
    list(["a", "b"]);
    focusListAfterRemoval(null, null);
    expect(document.activeElement).toBe(document.querySelector('[data-work-id="a"]'));
    list([]);
    focusListAfterRemoval(null, null);
    expect(document.activeElement).toBe(document.querySelector("[data-work-list]"));
  });

  it("ユーザーが他へ移していたら動かさない", () => {
    list(["a", "b"]);
    document.getElementById("other")?.focus();
    focusListAfterRemoval("b", document.getElementById("detail"));
    expect(document.activeElement).toBe(document.getElementById("other"));
  });

  it("解除した作品が選択中のときだけ選択を外す", () => {
    const route = { library: { selectedWorkId: "a" } } as unknown as AppRoute;
    expect(deselectLibraryWorkIfSelected(route, "a")?.selectedWorkId).toBeNull();
    expect(deselectLibraryWorkIfSelected(route, "b")).toBeNull();
  });

  it("詳細ページから戻った一覧は、取得中は待ち、描画されたら一度だけ移して要求を消す", () => {
    function Host({ pending }: { pending: boolean }) {
      useFocusListOnReturn(pending, 2, 2);
      return null;
    }
    const wrap = (pending: boolean) => (
      <Provider store={store}>
        <Host pending={pending} />
      </Provider>
    );
    list(["a", "b"]);
    const store = createStore();
    const view = render(wrap(true));
    act(() => store.set(focusListOnReturnAtom, { neighborId: "b" }));
    expect(document.activeElement).toBe(document.body);
    expect(store.get(focusListOnReturnAtom)).not.toBeNull();

    view.rerender(wrap(false));
    expect(document.activeElement).toBe(document.querySelector('[data-work-id="b"]'));
    expect(store.get(focusListOnReturnAtom)).toBeNull();

    // フォーカスを失わせて描画し直しても、消費済みの要求では移さない
    (document.activeElement as HTMLElement).blur();
    view.rerender(wrap(true));
    view.rerender(wrap(false));
    expect(document.activeElement).toBe(document.body);
  });

  it("行が描画されるまで（作品があるのに描画数が0のあいだ）は待ち、描画されたら移す", () => {
    function Host({ rendered }: { rendered: number }) {
      useFocusListOnReturn(false, 2, rendered);
      return null;
    }
    const wrap = (rendered: number) => (
      <Provider store={store}>
        <Host rendered={rendered} />
      </Provider>
    );
    list(["a", "b"]);
    const store = createStore();
    const view = render(wrap(0));
    act(() => store.set(focusListOnReturnAtom, { neighborId: "b" }));
    expect(document.activeElement).toBe(document.body);
    expect(store.get(focusListOnReturnAtom)).not.toBeNull();

    view.rerender(wrap(2));
    expect(document.activeElement).toBe(document.querySelector('[data-work-id="b"]'));
    expect(store.get(focusListOnReturnAtom)).toBeNull();
  });

  it("フォーカスが別の要素にあれば、描画されても移さず、要求は消す", () => {
    function Host() {
      useFocusListOnReturn(false, 2, 2);
      return null;
    }
    list(["a", "b"]);
    document.getElementById("other")?.focus();
    const store = createStore();
    render(
      <Provider store={store}>
        <Host />
      </Provider>,
    );
    act(() => store.set(focusListOnReturnAtom, { neighborId: "b" }));
    expect(document.activeElement).toBe(document.getElementById("other"));
    expect(store.get(focusListOnReturnAtom)).toBeNull();
  });
});
