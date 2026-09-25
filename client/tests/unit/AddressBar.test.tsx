// list/grid の決定は libraryViewModeAtom のみに依存する（ADR-0012 §3・§5）。
// 作品一覧（works）・値一覧（value-list）のどちらも同じ viewMode に従うため、
// 軸の種類に関わらずボタンの active 状態は viewMode と一致する。

import { createElement } from "react";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, afterEach, vi } from "vitest";
import AddressBar from "../../src/app/ui/AddressBar";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { appModeAtom } from "../../src/features/navigation/model/navigationAtoms";
import { activeAxisAtom } from "../../src/entities/library/model/navigationAtoms";
import { libraryViewModeAtom } from "../../src/features/library/model/atoms";
import { filesRelPathAtom } from "../../src/entities/file-system/model/navigationAtoms";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";

afterEach(cleanup);

function renderAddressBar(options?: {
  mode?: "library" | "files";
  activeAxis?: string;
  libraryViewMode?: "list" | "grid";
  rootFolder?: string;
  filesRelPath?: string[];
}) {
  const store = createStore();
  store.set(appModeAtom, options?.mode ?? "library");
  store.set(activeAxisAtom, (options?.activeAxis ?? "all") as never);
  store.set(libraryViewModeAtom, options?.libraryViewMode ?? "list");
  if (options?.filesRelPath) store.set(filesRelPathAtom, options.filesRelPath);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
    rootFolder: options?.rootFolder ?? "/library",
    lastScanTime: null,
  });

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

  it("ファイルモードでは「その他」ボタンが有効になり、現在地の絶対パスをコピーできる", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderAddressBar({
      mode: "files",
      rootFolder: "/library",
      filesRelPath: ["dlsite", "夜想曲スタジオ"],
    });

    const menuButton = screen.getByLabelText("その他");
    expect(menuButton).toBeEnabled();

    await userEvent.click(menuButton);
    const menu = screen.getByRole("menu");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "絶対パスをコピー" }));

    expect(writeText).toHaveBeenCalledWith("/library/dlsite/夜想曲スタジオ");
  });
});
