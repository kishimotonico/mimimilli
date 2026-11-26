import { act, cleanup, render } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { afterEach, describe, expect, it } from "vitest";
import { focusListOnReturnAtom } from "../../src/features/library/model/focusListOnReturnAtom";
import { focusListAfterRemoval } from "../../src/features/library/ui/neighborWorkId";
import { useFocusListOnReturn } from "../../src/features/library/ui/useFocusListOnReturn";
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
  it("フォーカスが消える詳細の中にあれば、隣の行へ移す", () => {
    list(["a", "b"]);
    document.getElementById("more")?.focus();
    focusListAfterRemoval("b", document.getElementById("detail"));
    expect(document.activeElement).toBe(document.querySelector('[data-work-id="b"]'));
  });

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

  it("作品詳細ページから戻った一覧は、描画されたら一度だけフォーカスを受け取る", () => {
    function Host({ pending }: { pending: boolean }) {
      useFocusListOnReturn(pending, 2, 2);
      return null;
    }
    list(["a", "b"]);
    const store = createStore();
    const view = render(
      <Provider store={store}>
        <Host pending />
      </Provider>,
    );
    act(() => store.set(focusListOnReturnAtom, true));
    expect(document.activeElement).toBe(document.body);
    list(["a", "b"]);
    view.rerender(
      <Provider store={store}>
        <Host pending={false} />
      </Provider>,
    );
    expect(document.activeElement).toBe(document.querySelector('[data-work-id="a"]'));
    expect(store.get(focusListOnReturnAtom)).toBe(false);
  });
});
