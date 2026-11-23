import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LibraryBreadcrumbs from "../../src/features/library/ui/LibraryBreadcrumbs";
import { LibraryNavigationContext } from "../../src/features/library/model/libraryNavigationContext";
import { clearResizeObservers, flushAllResizeObservers, mockElementSize } from "./setup";
import { groupsQueryOf, mockApi } from "../helpers/api";
import { buildGroupValueItem } from "../helpers/builders";
import { nts } from "../helpers/tag";
import { buildNav } from "./fixtures/libraryNav";
import type {
  LibraryViewActions,
  LibraryViewState,
} from "../../src/features/library/model/useLibraryNavigation";

/** 一覧が無い状態の nav には、操作だけを buildNav から借りる */
function buildNavActions(): LibraryViewActions {
  const { view: _view, folders: _folders, ...rest } = buildNav();
  const {
    foldersStatus: _s,
    refetchFolders: _r,
    selectedWorkId: _w,
    isPending: _p,
    ...actions
  } = rest;
  return actions;
}

beforeEach(() => {
  mockApi({ "GET /api/tag-prefixes": [] });
});

afterEach(() => {
  cleanup();
  clearResizeObservers();
});

function renderBreadcrumbs(nav: LibraryViewState & LibraryViewActions) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        "div",
        { className: "mle-app" },
        createElement(
          LibraryNavigationContext.Provider,
          { value: nav },
          createElement(LibraryBreadcrumbs),
        ),
      ),
    ),
  );
}

describe("LibraryBreadcrumbs", () => {
  it("値を選んでいなければ「ライブラリ / スマートフォルダー名」を出し、「ライブラリ」は「すべて」へ戻る", () => {
    const nav = buildNav({ library: { folderId: "fav" } });
    renderBreadcrumbs(nav);

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "ライブラリ",
      "お気に入り",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "ライブラリ" }));
    expect(nav.openFolder).toHaveBeenCalledWith("all");
  });

  it("グループの値の作品一覧は「ライブラリ / スマートフォルダー名 / 値」で、スマートフォルダー名は値一覧へ戻る操作（backToValueList）", () => {
    const nav = buildNav({ library: { folderId: "by-cv", group: "藤田茜" } });
    renderBreadcrumbs(nav);

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "ライブラリ",
      "CV別",
      "藤田茜",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "CV別" }));
    expect(nav.backToValueList).toHaveBeenCalledWith();
  });

  it("値をクリックすると兄弟の値のドロップダウンが開き、選ぶと selectGroupValue を呼ぶ", async () => {
    const api = mockApi({
      "GET /api/tag-prefixes": [],
      "GET /api/smart-folders/:id/groups": [
        buildGroupValueItem({ value: "藤田茜", count: 4 }),
        buildGroupValueItem({ value: "天音かなで", count: 3 }),
      ],
    });
    const sizeMock = mockElementSize(260, 260);
    const nav = buildNav({ library: { folderId: "by-cv", group: "藤田茜" } });
    renderBreadcrumbs(nav);

    fireEvent.click(screen.getByRole("button", { name: "藤田茜" }));
    await waitFor(() => {
      expect(document.querySelector('.mll-qlist__body[role="group"]')).toBeInTheDocument();
    });
    await waitFor(() =>
      expect(api.requestsTo("GET /api/smart-folders/:id/groups")).toHaveLength(1),
    );
    expect(groupsQueryOf(api.requestsTo("GET /api/smart-folders/:id/groups")[0]!)).toEqual({
      groupBy: "prefix:cv",
      groupSort: "count-desc",
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 260, height: 260 });
    });

    fireEvent.click(await screen.findByRole("button", { name: /^天音かなで ?3/ }));
    expect(nav.selectGroupValue).toHaveBeenCalledWith("天音かなで");
    sizeMock.restore();
  });

  it("兄弟の値のドロップダウンは、今のチップと検索語をかけた値と件数を取る", async () => {
    const api = mockApi({
      "GET /api/tag-prefixes": [],
      "GET /api/smart-folders/:id/groups": [buildGroupValueItem({ value: "天音かなで", count: 1 })],
    });
    const sizeMock = mockElementSize(260, 260);
    const nav = buildNav({
      library: { folderId: "by-cv", group: "藤田茜", selectedTags: nts(["ASMR"]), q: "雨" },
    });
    renderBreadcrumbs(nav);

    fireEvent.click(screen.getByRole("button", { name: "藤田茜" }));
    await waitFor(() =>
      expect(api.requestsTo("GET /api/smart-folders/:id/groups")).toHaveLength(1),
    );
    expect(groupsQueryOf(api.requestsTo("GET /api/smart-folders/:id/groups")[0]!)).toEqual({
      groupBy: "prefix:cv",
      groupSort: "count-desc",
      tags: ["ASMR"],
      q: "雨",
    });
    sizeMock.restore();
  });

  it("スマートフォルダー一覧が無い間は、仮の「すべて」を出さず「ライブラリ」だけにする", () => {
    for (const foldersStatus of ["pending", "error"] as const) {
      const { unmount } = renderBreadcrumbs({
        foldersStatus,
        refetchFolders: vi.fn(),
        selectedWorkId: null,
        isPending: false,
        ...buildNavActions(),
      });
      expect(screen.queryByRole("button", { name: "すべて" })).toBeNull();
      expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["ライブラリ"]);
      unmount();
    }
  });
});
