import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";
import LibraryGridControls from "../../src/features/library/ui/LibraryGridControls";
import { activeAxisAtom } from "../../src/entities/library/model/navigationAtoms";
import {
  libraryGridLayoutModeAtom,
  libraryViewModeAtom,
} from "../../src/features/library/model/atoms";

afterEach(cleanup);

function renderControls(store: ReturnType<typeof createStore>) {
  return render(
    <Provider store={store}>
      <LibraryGridControls />
    </Provider>,
  );
}

describe("LibraryGridControls", () => {
  it("グリッドモードかつ作品グリッドが描画可能な軸では敷き詰め形式トグルが有効", () => {
    const store = createStore();
    store.set(libraryViewModeAtom, "grid");
    store.set(activeAxisAtom, "all");
    renderControls(store);

    expect(screen.getByLabelText("カバーを1対1に切り抜き、等幅で並べる")).toBeEnabled();
    expect(screen.getByLabelText("カバーの縦横比を保ち、行の右端を揃えて並べる")).toBeEnabled();
  });

  it("敷き詰め形式トグルのクリックで libraryGridLayoutModeAtom を切り替える", async () => {
    const store = createStore();
    store.set(libraryViewModeAtom, "grid");
    store.set(activeAxisAtom, "all");
    renderControls(store);

    await userEvent.click(screen.getByLabelText("カバーの縦横比を保ち、行の右端を揃えて並べる"));

    expect(store.get(libraryGridLayoutModeAtom)).toBe("justified");
  });

  it("値一覧表示中（作品グリッドが描画されない facet 軸）ではトグルが disabled になる", () => {
    const store = createStore();
    store.set(libraryViewModeAtom, "grid");
    store.set(activeAxisAtom, "circle");
    renderControls(store);

    expect(screen.getByLabelText("カバーを1対1に切り抜き、等幅で並べる")).toBeDisabled();
  });

  it("リストモードではトグルが disabled になる", () => {
    const store = createStore();
    store.set(libraryViewModeAtom, "list");
    store.set(activeAxisAtom, "all");
    renderControls(store);

    expect(screen.getByLabelText("カバーを1対1に切り抜き、等幅で並べる")).toBeDisabled();
  });
});
