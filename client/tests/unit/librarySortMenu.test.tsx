// ソートメニュー: 今のソート（履歴エントリーの状態）の変更、既定のソートとして保存、値一覧のソート、並べ直す。

import { createElement } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { SmartFolder } from "@mimimilli/shared";
import GlobalToast from "../../src/app/ui/GlobalToast";
import LibrarySortMenu from "../../src/features/library/ui/LibrarySortMenu";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { LibraryNavigationContext } from "../../src/features/library/model/libraryNavigationContext";
import { libraryRouteAtom } from "../../src/entities/library/model/navigationAtoms";
import { apiError, mockApi } from "../helpers/api";
import { buildSmartFolder, defaultSmartFolders, seedSmartFolders } from "../helpers/smartFolders";
import { seedLibraryRoute } from "../helpers/route";
import { buildNav } from "./fixtures/libraryNav";

function renderSortMenu(options?: {
  folderId?: string;
  sort?: string | null;
  groupSort?: string | null;
  folders?: SmartFolder[];
  put?: (id: string) => unknown;
}) {
  let folders = options?.folders ?? defaultSmartFolders();
  const api = mockApi({
    "GET /api/smart-folders": () => folders,
    "PATCH /api/smart-folders/:id": ({ params, body }) => {
      if (options?.put) return options.put(params.id);
      const saved = {
        ...(folders.find((folder) => folder.id === params.id) ??
          buildSmartFolder({ id: params.id, name: "保存済み" })),
        ...(body as object),
      };
      folders = folders.map((folder) => (folder.id === saved.id ? saved : folder));
      return saved;
    },
  });
  const store = createStore();
  seedLibraryRoute(store, {
    folderId: options?.folderId ?? "all",
    sort: options && "sort" in options ? (options.sort as "added-desc" | null) : "added-desc",
    groupSort: (options?.groupSort ?? null) as "count-desc" | null,
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

/** 保存した並びが既定になり、メニューを開いても「このソートを既定にする」が出ない */
async function waitForNoSaveAsDefault() {
  await waitFor(() => expect(screen.queryByRole("menu", { name: "ソート" })).toBeNull());
  await userEvent.click(screen.getByRole("button", { name: "ソート" }));
  expect(screen.getByRole("menu", { name: "ソート" })).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByRole("menuitem", { name: "このソートを既定にする" })).toBeNull(),
  );
}

describe("LibrarySortMenu", () => {
  it("作品一覧ではソートメニューを開いて今の並びを変更できる", async () => {
    const { store } = renderSortMenu({ folderId: "all", sort: null });
    const button = screen.getByRole("button", { name: "ソート" });

    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("title", "ソート: 追加日（新しい順）");

    await userEvent.click(button);
    expect(screen.getByRole("menu", { name: "ソート" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("menuitemradio", { name: /タイトル（A→Z）/ }));
    expect(currentSort(store)).toBe("title-asc");
    await waitFor(() => expect(screen.queryByRole("menu", { name: "ソート" })).toBeNull());
  });

  it("今のソートが無いときはスマートフォルダーの既定のソートを表示する", async () => {
    renderSortMenu({ folderId: "recent", sort: null });
    expect(screen.getByRole("button", { name: "ソート" })).toHaveAttribute(
      "title",
      "ソート: 最近再生した順",
    );
  });

  it("「『すべて』と同じ」のスマートフォルダーは「すべて」の既定のソートの変更に従う", async () => {
    const folders = defaultSmartFolders().map((folder) =>
      folder.id === "all" ? { ...folder, sort: "title-asc" as const } : folder,
    );
    renderSortMenu({ folderId: "fav", sort: null, folders });

    expect(screen.getByRole("button", { name: "ソート" })).toHaveAttribute(
      "title",
      "ソート: タイトル（A→Z）",
    );
  });

  it("矢印キーで項目間をハイライト移動でき、先頭文字でも移動できる", async () => {
    renderSortMenu({ sort: "added-desc" });
    await userEvent.click(screen.getByRole("button", { name: "ソート" }));

    const menu = screen.getByRole("menu", { name: "ソート" });
    const items = screen.getAllByRole("menuitemradio");
    const highlighted = () => menu.getAttribute("aria-activedescendant");

    // 1回の keyboard() に複数のキーを渡すと、Ark UI（zag）は React の描画前の状態を読むので、前のキーの結果を
    // 見ずに次のキーを処理しうる。実際のキー入力のとおり、1キーずつ送って結果を確かめる
    const press = async (key: string, expected: number) => {
      await userEvent.keyboard(key);
      expect(highlighted()).toBe(items[expected]?.id);
    };
    await press("{ArrowDown}", 0);
    await press("{ArrowDown}", 1);
    await press("{ArrowUp}", 0);
    await press("{ArrowUp}", items.length - 1);
    await press("{ArrowDown}", 0);

    await userEvent.keyboard("I");
    await waitFor(() =>
      expect(highlighted()).toBe(items.find((item) => item.textContent === "ID順")?.id),
    );
  });

  it("キーボードで開くと現在の並びをハイライトし、マウスで開いたときは何もハイライトしない", async () => {
    renderSortMenu({ sort: "title-asc" });
    const button = screen.getByRole("button", { name: "ソート" });
    const highlighted = () => screen.getByRole("menu").getAttribute("aria-activedescendant");

    await userEvent.click(button);
    expect(highlighted()).toBeNull();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    button.focus();
    await userEvent.keyboard("{ArrowDown}");
    const current = await screen.findByRole("menuitemradio", { name: /タイトル（A→Z）/ });
    await waitFor(() => expect(highlighted()).toBe(current.id));
  });

  it("項目選択後、Escapeで閉じた後の両方でトリガーへフォーカスが戻る", async () => {
    renderSortMenu({ sort: "added-desc" });
    const button = screen.getByRole("button", { name: "ソート" });

    await userEvent.click(button);
    await userEvent.click(screen.getByRole("menuitemradio", { name: /タイトル（A→Z）/ }));
    await waitFor(() => expect(screen.queryByRole("menu", { name: "ソート" })).toBeNull());
    expect(button).toHaveFocus();

    await userEvent.click(button);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu", { name: "ソート" })).toBeNull());
    expect(button).toHaveFocus();
  });

  it("値一覧では8種のソートを出し、今の値一覧のソートを route へ書く（作品のソートには影響しない）", async () => {
    const { store } = renderSortMenu({ folderId: "by-cv", sort: "duration-desc" });
    const button = screen.getByRole("button", { name: "ソート" });

    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("title", "ソート: 件数（多い順）");

    await userEvent.click(button);
    const menu = screen.getByRole("menu", { name: "ソート" });
    expect(
      within(menu)
        .getAllByRole("menuitemradio")
        .map((item) => item.textContent),
    ).toEqual([
      "件数（多い順）",
      "件数（少ない順）",
      "名前（あ→ん）",
      "名前（ん→あ）",
      "総時間（長い順）",
      "総時間（短い順）",
      "最近追加した順",
      "最近再生した順",
    ]);
    expect(within(menu).getByRole("menuitemradio", { name: "件数（多い順）" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(menu).queryByRole("menuitemradio", { name: /タイトル/ })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: /既定にする/ })).not.toBeInTheDocument();

    await userEvent.click(within(menu).getByRole("menuitemradio", { name: "名前（あ→ん）" }));
    expect(store.get(libraryRouteAtom).groupSort).toBe("name-asc");
    expect(currentSort(store)).toBe("duration-desc");
  });

  it("追加年の値一覧は、名前順を年の古い順・新しい順と呼ぶ", async () => {
    renderSortMenu({ folderId: "by-year" });
    const button = screen.getByRole("button", { name: "ソート" });
    expect(button).toHaveAttribute("title", "ソート: 年（新しい順）");

    await userEvent.click(button);
    const menu = screen.getByRole("menu", { name: "ソート" });
    expect(within(menu).getByRole("menuitemradio", { name: "年（古い順）" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitemradio", { name: "年（新しい順）" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitemradio", { name: "名前（あ→ん）" })).toBeNull();
  });

  it("値一覧へ切り替えても、作品一覧へ戻ったときの今の並びは壊れない", async () => {
    const { store } = renderSortMenu({ folderId: "all", sort: "duration-desc" });

    act(() => {
      seedLibraryRoute(store, { folderId: "by-cv" });
    });
    await userEvent.click(screen.getByRole("button", { name: "ソート" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "総時間（長い順）" }));
    expect(store.get(libraryRouteAtom).groupSort).toBe("duration-desc");
    expect(currentSort(store)).toBe("duration-desc");

    act(() => {
      seedLibraryRoute(store, { folderId: "all" });
    });
    expect(screen.getByRole("button", { name: "ソート" })).toHaveAttribute(
      "title",
      "ソート: 再生時間（長い順）",
    );
  });

  it("値一覧のソートが既定から外れているときだけ「このソートを既定にする」を出し、保存すると今の並びは残ったまま既定と同じになって項目が消える", async () => {
    const { store, api } = renderSortMenu({ folderId: "by-cv", groupSort: "name-asc" });
    await userEvent.click(screen.getByRole("button", { name: "ソート" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "このソートを既定にする" }));

    await waitFor(() => expect(api.requestsTo("PATCH /api/smart-folders/:id")).toHaveLength(1));
    const [request] = api.requestsTo("PATCH /api/smart-folders/:id");
    expect(request?.params.id).toBe("by-cv");
    expect(request?.body).toEqual({ groupSort: "name-asc" });
    await waitForNoSaveAsDefault();
    expect(store.get(libraryRouteAtom).groupSort).toBe("name-asc");
  });

  it("解決後の並びがランダムのときだけ「並べ直す」を表示し、押すとseedが変わる", async () => {
    const { store } = renderSortMenu({ folderId: "all", sort: "added-desc" });
    expect(screen.queryByRole("button", { name: "並べ直す" })).not.toBeInTheDocument();

    act(() => {
      seedLibraryRoute(store, { sort: "random" });
    });
    const reshuffleButton = screen.getByRole("button", { name: "並べ直す" });
    const seedBefore = store.get(libraryRouteAtom).seed;

    await userEvent.click(reshuffleButton);
    expect(store.get(libraryRouteAtom).seed).not.toBe(seedBefore);
    expect(currentSort(store)).toBe("random");

    act(() => {
      seedLibraryRoute(store, { sort: "added-desc" });
    });
    expect(screen.queryByRole("button", { name: "並べ直す" })).not.toBeInTheDocument();
  });

  it("フォルダーの既定のソートがランダムなら今のソートが無くても「並べ直す」を表示する", async () => {
    renderSortMenu({ folderId: "random", sort: null });
    expect(screen.getByRole("button", { name: "並べ直す" })).toBeInTheDocument();
  });

  it("今の並びが既定と同じ・無いときは「このソートを既定にする」を出さない", async () => {
    renderSortMenu({ folderId: "all", sort: "added-desc" });
    await userEvent.click(screen.getByRole("button", { name: "ソート" }));
    expect(screen.queryByRole("menuitem", { name: "このソートを既定にする" })).toBeNull();
  });

  it("今の並びが既定から外れているときだけ「このソートを既定にする」を出す", async () => {
    renderSortMenu({ folderId: "all", sort: "title-asc" });
    await userEvent.click(screen.getByRole("button", { name: "ソート" }));
    const saveDefault = screen.getByRole("menuitem", { name: "このソートを既定にする" });
    expect(saveDefault).toBeInTheDocument();
    expect(saveDefault.querySelector("svg")).toBeNull();
    expect(
      screen.getByRole("menuitemradio", { name: /タイトル（A→Z）/ }).querySelector("svg"),
    ).not.toBeNull();
  });

  it("押すとそのスマートフォルダーの既定として解決済みの並びを PATCH する。今の並びは外さない", async () => {
    const { store, api } = renderSortMenu({ folderId: "fav", sort: "title-asc" });
    await userEvent.click(screen.getByRole("button", { name: "ソート" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "このソートを既定にする" }));

    await waitForNoSaveAsDefault();
    expect(currentSort(store)).toBe("title-asc");
    const [request] = api.requestsTo("PATCH /api/smart-folders/:id");
    expect(request?.params.id).toBe("fav");
    expect(request?.body).toEqual({ sort: "title-asc" });
  });

  it("保存に失敗したらトーストを出し、今の並びは残す", async () => {
    const { store } = renderSortMenu({
      folderId: "fav",
      sort: "title-asc",
      put: () => apiError(400, "invalid_request", "保存できません"),
    });
    await userEvent.click(screen.getByRole("button", { name: "ソート" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "このソートを既定にする" }));

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
        return buildSmartFolder({ id, name: "保存済み" });
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "ソート" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "このソートを既定にする" }));

    seedLibraryRoute(store, { folderId: "recent", sort: "title-asc" });
    release(null);

    await waitFor(() => expect(screen.getByRole("button", { name: "ソート" })).toBeEnabled());
    await act(async () => {
      await gate;
    });
    expect(currentSort(store)).toBe("title-asc");
    expect(store.get(libraryRouteAtom).folderId).toBe("recent");
  });

  it("「すべて」で押すと「すべて」の並びを PATCH する", async () => {
    const { store, api } = renderSortMenu({ folderId: "all", sort: "title-asc" });
    await userEvent.click(screen.getByRole("button", { name: "ソート" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "このソートを既定にする" }));

    await waitForNoSaveAsDefault();
    expect(currentSort(store)).toBe("title-asc");
    const [request] = api.requestsTo("PATCH /api/smart-folders/:id");
    expect(request?.params.id).toBe("all");
    expect(request?.body).toEqual({ sort: "title-asc" });
  });

  it("ソートはLibraryNavigationProviderが持つ単一のstartTransition（nav.setSort）を経由する", async () => {
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

    await userEvent.click(screen.getByRole("button", { name: "ソート" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /タイトル（A→Z）/ }));

    expect(nav.setSort).toHaveBeenCalledWith("title-asc");
  });

  it("存在しない ID の URL は「すべて」に解決され、その既定を保存しても今の並びは残る", async () => {
    const { store, api } = renderSortMenu({ folderId: "sf-gone", sort: "title-asc" });
    await userEvent.click(screen.getByRole("button", { name: "ソート" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "このソートを既定にする" }));

    await waitForNoSaveAsDefault();
    expect(currentSort(store)).toBe("title-asc");
    expect(api.requestsTo("PATCH /api/smart-folders/:id")[0]?.params.id).toBe("all");
    expect(store.get(libraryRouteAtom).folderId).toBe("all");
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

  it("取得中はソートを操作できず、PATCH も飛ばない", async () => {
    const api = renderUnavailable(() => new Promise<Response>(() => {}));
    expect(screen.getByRole("button", { name: "ソート" })).toBeDisabled();
    expect(api.requestsTo("PATCH /api/smart-folders/:id")).toHaveLength(0);
  });

  it("取得に失敗したときもソートを操作できず、PATCH も飛ばない", async () => {
    const api = renderUnavailable(() => apiError(500, "internal", "失敗"));
    await waitFor(() => expect(api.requestsTo("GET /api/smart-folders").length).toBeGreaterThan(0));
    expect(screen.getByRole("button", { name: "ソート" })).toBeDisabled();
    expect(api.requestsTo("PATCH /api/smart-folders/:id")).toHaveLength(0);
  });
});
