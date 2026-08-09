// TASK-146: スマートフォルダー軸ではソートメニューを無効化し、フォルダー定義のソートを表示する。

import { createElement } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { SmartFolder } from "@mimimilli/shared";
import LibrarySortMenu from "../../src/features/library/ui/LibrarySortMenu";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { activeAxisAtom, sortAtom } from "../../src/entities/library/model/navigationAtoms";
import { axisValueSortAtom } from "../../src/features/library/model/atoms";
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
      createElement(
        JotaiProvider,
        { store },
        createElement(LibraryNavigationProvider, null, createElement(LibrarySortMenu)),
      ),
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

  it("結果面が値一覧の軸では名前/件数/総時間のメニューを出し、axisValueSortAtomへ書き込む（ADR-0012帰結）", () => {
    const { store } = renderSortMenu({ axis: "cv", sort: "duration-desc" });
    const button = screen.getByRole("button", { name: "並び替え" });

    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("title", "並び替え: 件数");

    fireEvent.click(button);
    const menu = screen.getByRole("menu", { name: "並び替え" });
    expect(within(menu).getByRole("menuitemradio", { name: "名前" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: "件数" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: "総時間" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitemradio", { name: /タイトル/ })).not.toBeInTheDocument();

    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "名前" }));
    expect(store.get(axisValueSortAtom)).toEqual({ key: "name", direction: "asc" });
    // 値一覧のソートは作品一覧のソート（sortAtom）に影響しない
    expect(store.get(sortAtom)).toBe("duration-desc");
  });

  it("総時間ソート中に値一覧へ切り替えても、作品一覧へ戻ったときのソートは壊れない（二重state）", () => {
    const { store } = renderSortMenu({ axis: "all", sort: "duration-desc" });

    // 値一覧の軸へ遷移（同じメニューコンポーネントが接続先を切り替える）
    act(() => {
      store.set(activeAxisAtom, "cv");
    });
    fireEvent.click(screen.getByRole("button", { name: "並び替え" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "総時間" }));
    expect(store.get(axisValueSortAtom)).toEqual({ key: "duration", direction: "desc" });
    // 作品一覧側の sortAtom は無効なソートキーを受け取らず、選択前の値のまま
    expect(store.get(sortAtom)).toBe("duration-desc");

    // 作品一覧の軸へ戻る
    act(() => {
      store.set(activeAxisAtom, "all");
    });
    expect(screen.getByRole("button", { name: "並び替え" })).toHaveAttribute(
      "title",
      "並び替え: 再生時間（長い順）",
    );
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
