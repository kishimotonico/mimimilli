// TASK-61: 検索入力の IME composition 対応とクリア動作の検証。

import { act, createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import TopBar from "../../src/app/ui/TopBar";
import {
  librarySearchQueryAtom,
  selectedWorkIdAtom,
} from "../../src/entities/library/model/navigationAtoms";
import { appModeAtom } from "../../src/features/navigation/model/navigationAtoms";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";

const PLACEHOLDER = /ライブラリを検索/;

function renderTopBar(initialQuery = "") {
  const store = createStore();
  store.set(appModeAtom, "library");
  store.set(librarySearchQueryAtom, initialQuery);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), []);

  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store },
        createElement(TopBar, {
          onOpenScan: vi.fn(),
          onSettings: vi.fn(),
          notificationBell: createElement("span", { "aria-label": "通知" }),
        }),
      ),
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

  it("⌘K で検索ボックスへフォーカスする", () => {
    renderTopBar("");
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    input.blur();
    expect(document.activeElement).not.toBe(input);

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(input);
  });

  it("他のテキスト入力にフォーカス中の⌘Kは横取りしない", () => {
    renderTopBar("");
    const other = document.createElement("input");
    document.body.appendChild(other);
    other.focus();

    fireEvent.keyDown(other, { key: "k", ctrlKey: true });
    expect(document.activeElement).toBe(other);

    document.body.removeChild(other);
  });

  it("値がある状態のEscapeはクリアだけ行いフォーカスは検索欄に残る", () => {
    const store = renderTopBar("asmr");
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    input.focus();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
    expect(store.get(librarySearchQueryAtom)).toBe("");
    expect(document.activeElement).toBe(input);
  });

  it("空の状態のEscapeはblurして直前のフォーカス先へ戻す", () => {
    renderTopBar("");
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    fireEvent.focus(input, { relatedTarget: trigger });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });

  it("IME変換中のEscapeは無視する", () => {
    const store = renderTopBar("asmr");
    const input = screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;

    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Escape", isComposing: true });
    expect(input).toHaveValue("asmr");
    expect(store.get(librarySearchQueryAtom)).toBe("asmr");
  });

  it("作品詳細でも検索欄が使える", () => {
    const store = createStore();
    store.set(appModeAtom, "workDetail");
    store.set(librarySearchQueryAtom, "");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), []);
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          JotaiProvider,
          { store },
          createElement(TopBar, {
            onOpenScan: vi.fn(),
            onSettings: vi.fn(),
            notificationBell: createElement("span", { "aria-label": "通知" }),
          }),
        ),
      ),
    );
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument();
  });

  it("作品詳細でEnterを確定するとライブラリへ移り、直前の選択作品はプレビューに残す（意図した挙動）", () => {
    const store = createStore();
    store.set(appModeAtom, "workDetail");
    store.set(librarySearchQueryAtom, "");
    // 全画面詳細を開く前にライブラリ側で選択していた作品。検索確定はプレビュー文脈を
    // 壊さない設計とし、クリアしない（クリアしてもプレビューが空になるだけで得るものがない）。
    store.set(selectedWorkIdAtom, "RJ501011");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), []);
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          JotaiProvider,
          { store },
          createElement(TopBar, {
            onOpenScan: vi.fn(),
            onSettings: vi.fn(),
            notificationBell: createElement("span", { "aria-label": "通知" }),
          }),
        ),
      ),
    );
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: "asmr" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(store.get(appModeAtom)).toBe("library");
    expect(store.get(selectedWorkIdAtom)).toBe("RJ501011");
  });
});
