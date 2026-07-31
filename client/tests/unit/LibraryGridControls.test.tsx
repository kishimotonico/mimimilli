import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";
import LibraryGridControls from "../../src/features/library/ui/LibraryGridControls";
import {
  activeAxisAtom,
  drillValueAtom,
  gridInspectorOpenAtom,
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

describe("LibraryGridControls の詳細パネルトグル", () => {
  it("グリッドモードかつ描画可能な軸ではトグルが有効で、クリックで gridInspectorOpenAtom を反転する", async () => {
    const store = createStore();
    store.set(libraryViewModeAtom, "grid");
    store.set(activeAxisAtom, "all");
    renderControls(store);

    const toggle = screen.getByLabelText("詳細パネルの表示切り替え");
    expect(toggle).toBeEnabled();
    expect(store.get(gridInspectorOpenAtom)).toBe(false);

    await userEvent.click(toggle);

    expect(store.get(gridInspectorOpenAtom)).toBe(true);
  });

  it("ファセット一覧表示中（WorkGrid が描画されない軸）ではトグルが disabled になる", () => {
    const store = createStore();
    store.set(libraryViewModeAtom, "grid");
    store.set(activeAxisAtom, "circle");
    store.set(drillValueAtom, null);
    renderControls(store);

    expect(screen.getByLabelText("詳細パネルの表示切り替え")).toBeDisabled();
  });

  it("リストモードではトグルが disabled になる", () => {
    const store = createStore();
    store.set(libraryViewModeAtom, "list");
    store.set(activeAxisAtom, "all");
    renderControls(store);

    expect(screen.getByLabelText("詳細パネルの表示切り替え")).toBeDisabled();
  });

  it("ドリル済みファセット軸は viewMode=list でも全幅グリッドへ合流し、トグルが有効になる", () => {
    const store = createStore();
    store.set(libraryViewModeAtom, "list");
    store.set(activeAxisAtom, "circle");
    store.set(drillValueAtom, "月白製作所");
    renderControls(store);

    expect(screen.getByLabelText("詳細パネルの表示切り替え")).toBeEnabled();
  });
});
