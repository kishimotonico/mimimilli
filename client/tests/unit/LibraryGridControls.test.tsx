import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";
import LibraryGridControls from "../../src/features/library/ui/LibraryGridControls";
import { gridInspectorOpenAtom, libraryViewModeAtom } from "../../src/features/library/model/atoms";

afterEach(cleanup);

function renderControls(store: ReturnType<typeof createStore>) {
  return render(
    <Provider store={store}>
      <LibraryGridControls />
    </Provider>,
  );
}

describe("LibraryGridControls の詳細パネルトグル", () => {
  it("グリッドモードではトグルが有効で、クリックで gridInspectorOpenAtom を反転する", async () => {
    const store = createStore();
    store.set(libraryViewModeAtom, "grid");
    renderControls(store);

    const toggle = screen.getByLabelText("詳細パネルの表示切り替え");
    expect(toggle).toBeEnabled();
    expect(store.get(gridInspectorOpenAtom)).toBe(false);

    await userEvent.click(toggle);

    expect(store.get(gridInspectorOpenAtom)).toBe(true);
  });

  it("リストモードではトグルが disabled になる", () => {
    const store = createStore();
    store.set(libraryViewModeAtom, "list");
    renderControls(store);

    expect(screen.getByLabelText("詳細パネルの表示切り替え")).toBeDisabled();
  });
});
