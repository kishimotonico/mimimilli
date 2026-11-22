// 並び順メニュー: 今の並び（履歴エントリーの状態）の変更、既定の並びとして保存、値一覧のソート、並べ直す。

import { createElement } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { SmartFolderItem } from "@mimimilli/shared";
import GlobalToast from "../../src/app/ui/GlobalToast";
import LibrarySortMenu from "../../src/features/library/ui/LibrarySortMenu";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { LibraryNavigationContext } from "../../src/features/library/model/libraryNavigationContext";
import { libraryRouteAtom } from "../../src/entities/library/model/navigationAtoms";
import { axisValueSortAtom } from "../../src/features/library/model/atoms";
import { apiError, mockApi } from "../helpers/api";
import {
  buildSmartFolderItem,
  defaultSmartFolderItems,
  seedSmartFolders,
} from "../helpers/smartFolders";
import { seedLibraryRoute } from "../helpers/route";
import { buildNav } from "./fixtures/libraryNav";

function renderSortMenu(options?: {
  folderId?: string;
  sort?: string | null;
  folders?: SmartFolderItem[];
  put?: (id: string) => unknown;
}) {
  const api = mockApi({
    "GET /api/smart-folders": options?.folders ?? defaultSmartFolderItems(),
    "PUT /api/smart-folders/:id": ({ params }) =>
      options?.put
        ? options.put(params.id)
        : buildSmartFolderItem({ id: params.id, name: "保存済み" }),
  });
  const store = createStore();
  seedLibraryRoute(store, {
    folderId: options?.folderId ?? "all",
    sort: options && "sort" in options ? (options.sort as "added-desc" | null) : "added-desc",
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedSmartFolders(queryClient, options?.folders);

  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store },
        createElement(
          LibraryNavigationProvider,
          null,
          createElement(GlobalToast),
          createElement(LibrarySortMenu),
        ),
      ),
    ),
  );

  return { store, queryClient, api };
}

const currentSort = (store: ReturnType<typeof createStore>) => store.get(libraryRouteAtom).sort;

describe("LibrarySortMenu", () => {
  it("作品一覧ではソートメニューを開いて今の並びを変更できる", () => {
    const { store } = renderSortMenu({ folderId: "all", sort: null });
    const button = screen.getByRole("button", { name: "並び替え" });

    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("title", "並び替え: 追加日（新しい順）");

    fireEvent.click(button);
    expect(screen.getByRole("menu", { name: "並び替え" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemradio", { name: /タイトル（A→Z）/ }));
    expect(currentSort(store)).toBe("title-asc");
    expect(screen.queryByRole("menu", { name: "並び替え" })).not.toBeInTheDocument();
  });

  it("今の並びが無いときはスマートフォルダーの既定の並びを表示する", () => {
    renderSortMenu({ folderId: "recent", sort: null });
    expect(screen.getByRole("button", { name: "並び替え" })).toHaveAttribute(
      "title",
      "並び替え: 最近再生した順",
    );
  });

  it("「『すべて』と同じ」のスマートフォルダーは「すべて」の既定の並びの変更に従う", () => {
    const folders = defaultSmartFolderItems().map((folder) =>
      folder.id === "all" ? { ...folder, sort: "title-asc" as const } : folder,
    );
    renderSortMenu({ folderId: "fav", sort: null, folders });

    expect(screen.getByRole("button", { name: "並び替え" })).toHaveAttribute(
      "title",
      "並び替え: タイトル（A→Z）",
    );
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

  it("初期フォーカス・ArrowキーによるフォーカスはpreventScroll:trueで祖先を自動スクロールしない", () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");
    renderSortMenu({ sort: "title-asc" });
    fireEvent.click(screen.getByRole("button", { name: "並び替え" }));

    expect(focusSpy).toHaveBeenLastCalledWith({ preventScroll: true });

    const menu = screen.getByRole("menu", { name: "並び替え" });
    focusSpy.mockClear();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(focusSpy).toHaveBeenLastCalledWith({ preventScroll: true });

    focusSpy.mockRestore();
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

  it("読めないスマートフォルダーではソートメニューを無効化する", () => {
    renderSortMenu({
      folderId: "sf-broken",
      folders: [
        ...defaultSmartFolderItems(),
        buildSmartFolderItem({ id: "sf-broken", name: "壊れた行", condition: null }),
      ],
    });
    const button = screen.getByRole("button", { name: "並び替え" });

    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(screen.queryByRole("menu", { name: "並び替え" })).not.toBeInTheDocument();
  });

  it("値一覧では名前/件数/総時間のメニューを出し、axisValueSortAtomへ書き込む（ADR-0012帰結）", () => {
    const { store } = renderSortMenu({ folderId: "by-cv", sort: "duration-desc" });
    const button = screen.getByRole("button", { name: "並び替え" });

    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("title", "並び替え: 件数");

    fireEvent.click(button);
    const menu = screen.getByRole("menu", { name: "並び替え" });
    expect(within(menu).getByRole("menuitemradio", { name: "名前" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: "件数" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: "総時間" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitemradio", { name: /タイトル/ })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: /既定にする/ })).not.toBeInTheDocument();

    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "名前" }));
    expect(store.get(axisValueSortAtom)).toEqual({ key: "name", direction: "asc" });
    // 値一覧のソートは今の並びに影響しない
    expect(currentSort(store)).toBe("duration-desc");
  });

  it("値一覧へ切り替えても、作品一覧へ戻ったときの今の並びは壊れない（二重state）", () => {
    const { store } = renderSortMenu({ folderId: "all", sort: "duration-desc" });

    act(() => {
      seedLibraryRoute(store, { folderId: "by-cv" });
    });
    fireEvent.click(screen.getByRole("button", { name: "並び替え" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "総時間" }));
    expect(store.get(axisValueSortAtom)).toEqual({ key: "duration", direction: "desc" });
    expect(currentSort(store)).toBe("duration-desc");

    act(() => {
      seedLibraryRoute(store, { folderId: "all" });
    });
    expect(screen.getByRole("button", { name: "並び替え" })).toHaveAttribute(
      "title",
      "並び替え: 再生時間（長い順）",
    );
  });

  it("解決後の並びがランダムのときだけ「並べ直す」を表示し、押すとseedが変わる", () => {
    const { store } = renderSortMenu({ folderId: "all", sort: "added-desc" });
    expect(screen.queryByRole("button", { name: "並べ直す" })).not.toBeInTheDocument();

    act(() => {
      seedLibraryRoute(store, { sort: "random" });
    });
    const reshuffleButton = screen.getByRole("button", { name: "並べ直す" });
    const seedBefore = store.get(libraryRouteAtom).seed;

    fireEvent.click(reshuffleButton);
    expect(store.get(libraryRouteAtom).seed).not.toBe(seedBefore);
    expect(currentSort(store)).toBe("random");

    act(() => {
      seedLibraryRoute(store, { sort: "added-desc" });
    });
    expect(screen.queryByRole("button", { name: "並べ直す" })).not.toBeInTheDocument();
  });

  it("フォルダーの既定の並びがランダムなら今の並びが無くても「並べ直す」を表示する", () => {
    renderSortMenu({ folderId: "random", sort: null });
    expect(screen.getByRole("button", { name: "並べ直す" })).toBeInTheDocument();
  });

  it("今の並びが既定と同じ・無いときは「この並びを既定にする」を出さない", () => {
    renderSortMenu({ folderId: "all", sort: "added-desc" });
    fireEvent.click(screen.getByRole("button", { name: "並び替え" }));
    expect(screen.queryByRole("menuitem", { name: "この並びを既定にする" })).toBeNull();
  });

  it("今の並びが既定から外れているときだけ「この並びを既定にする」を出す", () => {
    renderSortMenu({ folderId: "all", sort: "title-asc" });
    fireEvent.click(screen.getByRole("button", { name: "並び替え" }));
    expect(screen.getByRole("menuitem", { name: "この並びを既定にする" })).toBeInTheDocument();
  });

  it("押すとそのスマートフォルダーの既定として解決済みの並びを PUT し、今の並びを null に戻す", async () => {
    const { store, api } = renderSortMenu({ folderId: "fav", sort: "title-asc" });
    fireEvent.click(screen.getByRole("button", { name: "並び替え" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "この並びを既定にする" }));

    await waitFor(() => expect(currentSort(store)).toBeNull());
    const [request] = api.requestsTo("PUT /api/smart-folders/:id");
    expect(request?.params.id).toBe("fav");
    expect(request?.body).toEqual({
      name: "お気に入り",
      condition: { type: "and", children: [{ type: "bookmarked" }] },
      sort: "title-asc",
      groupBy: null,
    });
  });

  it("保存に失敗したらトーストを出し、今の並びは残す", async () => {
    const { store } = renderSortMenu({
      folderId: "fav",
      sort: "title-asc",
      put: () => apiError(400, "invalid_request", "保存できません"),
    });
    fireEvent.click(screen.getByRole("button", { name: "並び替え" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "この並びを既定にする" }));

    expect(await screen.findByText("保存できません")).toBeInTheDocument();
    expect(currentSort(store)).toBe("title-asc");
  });

  it("保存の完了前に別のスマートフォルダーへ移っていたら、移った先の今の並びは消さない", async () => {
    let release: (value: unknown) => void = () => {};
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const { store } = renderSortMenu({
      folderId: "fav",
      sort: "title-asc",
      put: async (id) => {
        await gate;
        return buildSmartFolderItem({ id, name: "保存済み" });
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "並び替え" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "この並びを既定にする" }));

    seedLibraryRoute(store, { folderId: "recent", sort: "title-asc" });
    release(null);

    await waitFor(() => expect(screen.getByRole("button", { name: "並び替え" })).toBeEnabled());
    await act(async () => {
      await gate;
    });
    expect(currentSort(store)).toBe("title-asc");
    expect(store.get(libraryRouteAtom).folderId).toBe("recent");
  });

  it("「すべて」で押すと「すべて」の並びを PUT する", async () => {
    const { store, api } = renderSortMenu({ folderId: "all", sort: "title-asc" });
    fireEvent.click(screen.getByRole("button", { name: "並び替え" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "この並びを既定にする" }));

    await waitFor(() => expect(currentSort(store)).toBeNull());
    const [request] = api.requestsTo("PUT /api/smart-folders/:id");
    expect(request?.params.id).toBe("all");
    expect(request?.body).toMatchObject({ sort: "title-asc" });
  });

  it("並び替えはLibraryNavigationProviderが持つ単一のstartTransition（nav.setSort）を経由する", () => {
    // ソートメニューだけの独立した遷移を持つと、他コンポーネントの遷移中表示
    // （WorkListPaneのis-pending暗転）にこの操作が反映されなくなる。
    const nav = buildNav();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          LibraryNavigationContext.Provider,
          { value: nav },
          createElement(LibrarySortMenu),
        ),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "並び替え" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /タイトル（A→Z）/ }));

    expect(nav.setSort).toHaveBeenCalledWith("title-asc");
  });

  it("存在しない ID の URL は「すべて」に解決され、その既定を保存すると今の並びが外れる", async () => {
    const { store, api } = renderSortMenu({ folderId: "sf-gone", sort: "title-asc" });
    fireEvent.click(screen.getByRole("button", { name: "並び替え" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "この並びを既定にする" }));

    await waitFor(() => expect(currentSort(store)).toBeNull());
    expect(api.requestsTo("PUT /api/smart-folders/:id")[0]?.params.id).toBe("all");
  });
});

describe("LibrarySortMenu: スマートフォルダー一覧が無い間", () => {
  function renderUnavailable(list: () => unknown) {
    const api = mockApi({ "GET /api/smart-folders": list });
    const store = createStore();
    seedLibraryRoute(store, { folderId: "fav", sort: "title-asc" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
    return api;
  }

  it("取得中は並び替えを操作できず、PUT も飛ばない", () => {
    const api = renderUnavailable(() => new Promise<Response>(() => {}));
    expect(screen.getByRole("button", { name: "並び替え" })).toBeDisabled();
    expect(api.requestsTo("PUT /api/smart-folders/:id")).toHaveLength(0);
  });

  it("取得に失敗したときも並び替えを操作できず、PUT も飛ばない", async () => {
    const api = renderUnavailable(() => apiError(500, "internal", "失敗"));
    await waitFor(() => expect(api.requestsTo("GET /api/smart-folders").length).toBeGreaterThan(0));
    expect(screen.getByRole("button", { name: "並び替え" })).toBeDisabled();
    expect(api.requestsTo("PUT /api/smart-folders/:id")).toHaveLength(0);
  });
});
