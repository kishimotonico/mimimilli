// list/grid の決定は libraryViewModeAtom のみに依存する（ADR-0012 §3・§5）。
// 作品一覧（works）・値一覧（value-list）のどちらも同じ viewMode に従うため、
// 軸の種類に関わらずボタンの active 状態は viewMode と一致する。

import { createElement } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, afterEach } from "vitest";
import AddressBar from "../../src/app/ui/AddressBar";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { appModeAtom } from "../../src/features/navigation/model/navigationAtoms";
import { activeAxisAtom } from "../../src/entities/library/model/navigationAtoms";
import { libraryViewModeAtom } from "../../src/features/library/model/atoms";

afterEach(cleanup);

function renderAddressBar(options?: {
  mode?: "library" | "files";
  activeAxis?: string;
  libraryViewMode?: "list" | "grid";
}) {
  const store = createStore();
  store.set(appModeAtom, options?.mode ?? "library");
  store.set(activeAxisAtom, (options?.activeAxis ?? "all") as never);
  store.set(libraryViewModeAtom, options?.libraryViewMode ?? "list");

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store },
        createElement(LibraryNavigationProvider, null, createElement(AddressBar)),
      ),
    ),
  );

  return { store };
}

describe("AddressBar のビュー切替ボタン", () => {
  it("作品一覧を表示する軸ではリスト/グリッドが選好どおり active になる", () => {
    renderAddressBar({ activeAxis: "all", libraryViewMode: "list" });

    expect(screen.getByLabelText("リスト")).toBeEnabled();
    expect(screen.getByLabelText("リスト")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("グリッド")).toHaveAttribute("aria-pressed", "false");

    cleanup();
    renderAddressBar({ activeAxis: "all", libraryViewMode: "grid" });
    expect(screen.getByLabelText("グリッド")).toHaveAttribute("aria-pressed", "true");
  });

  it("facet 軸（値一覧）でも viewMode=grid ならグリッドボタンが active になる", () => {
    renderAddressBar({ activeAxis: "circle", libraryViewMode: "grid" });

    expect(screen.getByLabelText("グリッド")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("リスト")).toHaveAttribute("aria-pressed", "false");
  });

  it("ファイルモードではリスト/グリッドに理由を示す title が付く", () => {
    renderAddressBar({ mode: "files" });

    expect(screen.getByLabelText("リスト")).toHaveAttribute(
      "title",
      "ファイルモードはカラム表示のみ",
    );
    expect(screen.getByLabelText("グリッド")).toHaveAttribute(
      "title",
      "ファイルモードはカラム表示のみ",
    );
  });

  it("「その他」ボタンは未実装のため disabled で title が付く", () => {
    renderAddressBar();

    expect(screen.getByLabelText("その他")).toBeDisabled();
    expect(screen.getByLabelText("その他")).toHaveAttribute("title", "近日実装");
  });
});
