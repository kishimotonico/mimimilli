// TASK-146: スマートフォルダー軸ではソートメニューを無効化し、フォルダー定義のソートを表示する。

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { SmartFolder } from "@mimimilli/shared";
import LibrarySortMenu from "../../src/features/library/ui/LibrarySortMenu";
import { activeAxisAtom, sortAtom } from "../../src/features/library/model/atoms";
import { SMART_FOLDER_QUERY_KEYS } from "../../src/entities/smart-folder/queryKeys";

const SMART_FOLDER: SmartFolder = {
  id: "sf-1",
  name: "お気に入りASMR",
  rules: [],
  sort: "title-asc",
};

function renderSortMenu(options?: { axis?: string; sort?: string; smartFolders?: SmartFolder[] }) {
  const store = createStore();
  store.set(activeAxisAtom, options?.axis ?? "all");
  store.set(sortAtom, (options?.sort ?? "added-desc") as "added-desc");

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (options?.smartFolders) {
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.all(), options.smartFolders);
  }

  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, createElement(LibrarySortMenu)),
    ),
  );

  return { store, queryClient };
}

describe("LibrarySortMenu", () => {
  it("通常軸ではソートメニューを開いて並び順を変更できる", () => {
    const { store } = renderSortMenu({ axis: "all", sort: "added-desc" });
    const button = screen.getByRole("button", { name: "並び替え" });

    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("title", "並び替え: 追加日（新しい順）");

    fireEvent.click(button);
    expect(screen.getByRole("menu", { name: "並び替え" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemradio", { name: /タイトル（A→Z）/ }));
    expect(store.get(sortAtom)).toBe("title-asc");
    expect(screen.queryByRole("menu", { name: "並び替え" })).not.toBeInTheDocument();
  });

  it("開くと現在の並び順の項目に初期フォーカスする", () => {
    renderSortMenu({ sort: "title-asc" });
    fireEvent.click(screen.getByRole("button", { name: "並び替え" }));

    expect(screen.getByRole("menuitemradio", { name: /タイトル（A→Z）/ })).toHaveFocus();
  });

  it("ArrowDown/ArrowUpで項目間をフォーカス移動できる", () => {
    renderSortMenu({ sort: "added-desc" });
    fireEvent.click(screen.getByRole("button", { name: "並び替え" }));

    const menu = screen.getByRole("menu", { name: "並び替え" });
    const items = screen.getAllByRole("menuitemradio");
    expect(items[0]).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(items[1]).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(items[0]).toHaveFocus();

    // 先頭で ArrowUp すると末尾へ巡回する
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(items[items.length - 1]).toHaveFocus();
  });

  it("項目選択後、Escapeで閉じた後の両方でトリガーへフォーカスが戻る", () => {
    renderSortMenu({ sort: "added-desc" });
    const button = screen.getByRole("button", { name: "並び替え" });

    fireEvent.click(button);
    fireEvent.click(screen.getByRole("menuitemradio", { name: /タイトル（A→Z）/ }));
    expect(screen.queryByRole("menu", { name: "並び替え" })).not.toBeInTheDocument();
    expect(button).toHaveFocus();

    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "並び替え" })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("スマートフォルダー軸ではソートメニューを無効化し、フォルダー定義のソートを表示する", () => {
    renderSortMenu({
      axis: "smart-sf-1",
      smartFolders: [SMART_FOLDER],
    });
    const button = screen.getByRole("button", { name: "並び替え" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "並び順はスマートフォルダーの設定に従います（タイトル（A→Z））",
    );
    expect(button).not.toHaveAttribute("aria-haspopup");

    fireEvent.click(button);
    expect(screen.queryByRole("menu", { name: "並び替え" })).not.toBeInTheDocument();
  });

  it("スマートフォルダー一覧に該当フォルダーがないときも無効化を維持する", () => {
    renderSortMenu({
      axis: "smart-missing",
      smartFolders: [SMART_FOLDER],
    });
    const button = screen.getByRole("button", { name: "並び替え" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "並び順はスマートフォルダーの設定に従います");
    fireEvent.click(button);
    expect(screen.queryByRole("menu", { name: "並び替え" })).not.toBeInTheDocument();
  });
});
