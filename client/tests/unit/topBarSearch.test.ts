// TASK-61: 検索入力の IME composition 対応とクリア動作の検証。

import { act, createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import TopBar from "../../src/app/ui/TopBar";
import { librarySearchQueryAtom } from "../../src/features/library/model/atoms";
import { appModeAtom } from "../../src/features/navigation/model/navigationAtoms";

const PLACEHOLDER = /ライブラリを検索/;

function renderTopBar(initialQuery = "") {
  const store = createStore();
  store.set(appModeAtom, "library");
  store.set(librarySearchQueryAtom, initialQuery);

  render(
    createElement(
      JotaiProvider,
      { store },
      createElement(TopBar, {
        onOpenScan: vi.fn(),
        onSettings: vi.fn(),
        notificationBell: createElement("span", { "aria-label": "通知" }),
      }),
    ),
  );
  return store;
}

describe("TopBar の検索入力", () => {
  it("通常入力は即時表示され atom へも即時反映される", () => {
    const store = renderTopBar("");
    const input = screen.getByPlaceholderText(PLACEHOLDER);

    fireEvent.change(input, { target: { value: "asmr" } });
    expect(input).toHaveValue("asmr");
    expect(store.get(librarySearchQueryAtom)).toBe("asmr");
  });

  it("IME composition 中は atom へ反映せず表示だけ更新し、確定時に反映する", () => {
    const store = renderTopBar("");
    const input = screen.getByPlaceholderText(PLACEHOLDER);

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "あ" } });
    fireEvent.change(input, { target: { value: "あい" } });
    expect(store.get(librarySearchQueryAtom)).toBe("");
    expect(input).toHaveValue("あい");

    fireEvent.compositionEnd(input);
    expect(store.get(librarySearchQueryAtom)).toBe("あい");
  });

  it("クリアボタンで表示・atom ともに即時空になる", () => {
    const store = renderTopBar("asmr");
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    expect(input).toHaveValue("asmr");

    fireEvent.click(screen.getByRole("button", { name: "検索をクリア" }));
    expect(store.get(librarySearchQueryAtom)).toBe("");
    expect(input).toHaveValue("");
  });

  it("atom の値が外部要因で変わったとき表示が追従する", () => {
    const store = renderTopBar("");
    const input = screen.getByPlaceholderText(PLACEHOLDER);

    act(() => {
      store.set(librarySearchQueryAtom, "復元された語");
    });
    expect(input).toHaveValue("復元された語");
  });
});
