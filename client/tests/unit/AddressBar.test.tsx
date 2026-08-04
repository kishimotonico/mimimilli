// list/grid の決定は libraryViewModeAtom のみに依存する（ADR-0012 §3）。
// ドリル機構の廃止に伴い、facet/tag 軸を選んでいても強制グリッドにはならない
// （その軸は値一覧を表示するだけで作品グリッド自体を描画しないため、単に
// グリッドボタンが「効かない」状態になる）。

import { createElement } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, afterEach } from "vitest";
import AddressBar from "../../src/app/ui/AddressBar";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { appModeAtom } from "../../src/features/navigation/model/navigationAtoms";
import { activeAxisAtom, libraryViewModeAtom } from "../../src/features/library/model/atoms";

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

  it("facet 軸（値一覧）では viewMode=grid でも強制グリッドにならない（値一覧はグリッド概念を持たない）", () => {
    renderAddressBar({ activeAxis: "circle", libraryViewMode: "grid" });

    // circle は value-list 種の結果面のため、isWorksGridActive は常に false になる
    expect(screen.getByLabelText("グリッド")).toHaveAttribute("aria-pressed", "false");
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
