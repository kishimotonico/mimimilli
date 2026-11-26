import { act, cleanup, render } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import type { WorkListItem } from "@mimimilli/shared";
import { afterEach, describe, expect, it } from "vitest";
import { listFocusRequestAtom } from "../../src/features/library/model/listFocusRequestAtom";
import { useFocusListAfterReturn } from "../../src/features/library/ui/useFocusListAfterReturn";

afterEach(cleanup);

const item = (id: string) => ({ id }) as WorkListItem;

function List({ works }: { works: WorkListItem[] }) {
  const focusable = useFocusListAfterReturn(works, false, works.length);
  return (
    <div data-work-list tabIndex={works.length === 0 || focusable ? -1 : undefined}>
      {works.map((work, index) => (
        <button key={work.id} data-work-id={work.id} tabIndex={index === 0 ? 0 : -1}>
          {work.id}
        </button>
      ))}
    </div>
  );
}

function setup(works: WorkListItem[]) {
  const store = createStore();
  const view = render(
    <Provider store={store}>
      <List works={works} />
    </Provider>,
  );
  return {
    store,
    rerender: (next: WorkListItem[]) =>
      view.rerender(
        <Provider store={store}>
          <List works={next} />
        </Provider>,
      ),
  };
}

describe("useFocusListAfterReturn", () => {
  it("解除した作品がまだ一覧にあるあいだはコンテナへ預け、無くなったら roving の行へ移して要求を消す", () => {
    const { store, rerender } = setup([item("a"), item("b")]);
    act(() => store.set(listFocusRequestAtom, "a"));
    expect(document.activeElement).toBe(document.querySelector("[data-work-list]"));

    rerender([item("b")]);
    expect(document.activeElement).toBe(document.querySelector('[data-work-id="b"]'));
    expect(store.get(listFocusRequestAtom)).toBeNull();
  });

  it("フォーカスが別の要素にあれば奪わない", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    const { store, rerender } = setup([item("a"), item("b")]);
    act(() => store.set(listFocusRequestAtom, "a"));
    outside.focus();
    rerender([item("b")]);
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("一覧が空になったらコンテナに残る", () => {
    const { store, rerender } = setup([item("a")]);
    act(() => store.set(listFocusRequestAtom, "a"));
    rerender([]);
    expect(document.activeElement).toBe(document.querySelector("[data-work-list]"));
  });
});
