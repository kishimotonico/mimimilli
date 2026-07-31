// ドリル済みファセット軸は viewMode にかかわらず常に全幅グリッドへ合流する
// （libraryPresentation.ts）。リストボタンを押しても表示は変わらないため、
// ドリル中はリストボタンを disabled にし、active 表示は showGrid の実態に揃える。

import { createElement } from "react";
import { act, render, screen, cleanup } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, afterEach } from "vitest";
import AddressBar from "../../src/app/ui/AddressBar";
import { appModeAtom } from "../../src/features/navigation/model/navigationAtoms";
import {
  activeAxisAtom,
  drillValueAtom,
  libraryViewModeAtom,
} from "../../src/features/library/model/atoms";

afterEach(cleanup);

function renderAddressBar(options?: {
  activeAxis?: string;
  drillValue?: string | null;
  libraryViewMode?: "list" | "grid";
}) {
  const store = createStore();
  store.set(appModeAtom, "library");
  store.set(activeAxisAtom, (options?.activeAxis ?? "all") as never);
  store.set(drillValueAtom, options?.drillValue ?? null);
  store.set(libraryViewModeAtom, options?.libraryViewMode ?? "list");

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, createElement(AddressBar)),
    ),
  );

  return { store };
}

describe("AddressBar のビュー切替ボタン", () => {
  it("通常軸ではリストボタンが有効で、選好どおり active になる", () => {
    renderAddressBar({ activeAxis: "all", drillValue: null, libraryViewMode: "list" });

    expect(screen.getByLabelText("リスト")).toBeEnabled();
    expect(screen.getByLabelText("リスト")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("グリッド")).toHaveAttribute("aria-pressed", "false");
  });

  it("ドリル済みファセット軸では viewMode=list でもリストボタンが disabled になり、グリッドボタンが active になる", () => {
    renderAddressBar({ activeAxis: "circle", drillValue: "月白製作所", libraryViewMode: "list" });

    expect(screen.getByLabelText("リスト")).toBeDisabled();
    expect(screen.getByLabelText("リスト")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("グリッド")).toHaveAttribute("aria-pressed", "true");
  });

  it("ドリルを抜けるとリストボタンが再び有効になる", () => {
    const { store } = renderAddressBar({
      activeAxis: "circle",
      drillValue: "月白製作所",
      libraryViewMode: "list",
    });
    expect(screen.getByLabelText("リスト")).toBeDisabled();

    act(() => {
      store.set(drillValueAtom, null);
    });

    expect(screen.getByLabelText("リスト")).toBeEnabled();
  });
});
