import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import SidebarToggleButton from "../../src/features/library/ui/SidebarToggleButton";
import { librarySidebarOpenAtom } from "../../src/features/library/model/sidebarAtoms";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderToggle() {
  const store = createStore();
  store.set(librarySidebarOpenAtom, true);
  render(
    <Provider store={store}>
      <SidebarToggleButton />
      <input aria-label="入力欄" />
    </Provider>,
  );
  return store;
}

describe("SidebarToggleButton", () => {
  it("ボタンでサイドバーを隠す・出すを切り替え、押下状態を反映する", () => {
    const store = renderToggle();
    const button = screen.getByRole("button", { name: "サイドバー" });
    expect(button).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(button);
    expect(store.get(librarySidebarOpenAtom)).toBe(false);
    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button);
    expect(store.get(librarySidebarOpenAtom)).toBe(true);
  });

  it("Ctrl+B と ⌘B で切り替える", () => {
    const store = renderToggle();

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(store.get(librarySidebarOpenAtom)).toBe(false);
    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(store.get(librarySidebarOpenAtom)).toBe(true);
  });

  it("入力欄にフォーカスがあるときは Ctrl+B を奪わない", () => {
    const store = renderToggle();
    const input = screen.getByLabelText("入力欄");
    input.focus();

    fireEvent.keyDown(input, { key: "b", ctrlKey: true });
    expect(store.get(librarySidebarOpenAtom)).toBe(true);
  });

  it("状態を端末（localStorage）に保存する", () => {
    renderToggle();
    fireEvent.click(screen.getByRole("button", { name: "サイドバー" }));

    expect(localStorage.getItem("mimimilli:librarySidebarOpen")).toBe("false");
  });
});
