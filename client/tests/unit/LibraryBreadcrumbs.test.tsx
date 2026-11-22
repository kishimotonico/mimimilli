import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LibraryBreadcrumbs from "../../src/features/library/ui/LibraryBreadcrumbs";
import { LibraryNavigationContext } from "../../src/features/library/model/libraryNavigationContext";
import { clearResizeObservers, flushAllResizeObservers, mockElementSize } from "./setup";
import { mockApi } from "../helpers/api";
import { buildAxisFacetItem } from "../helpers/builders";
import { buildNav } from "./fixtures/libraryNav";
import type {
  LibraryViewActions,
  LibraryViewState,
} from "../../src/features/library/model/useLibraryNavigation";

/** 一覧が無い状態の nav には、操作だけを buildNav から借りる */
function buildNavActions(): LibraryViewActions {
  const { view: _view, folders: _folders, selectedTags: _t, searchQuery: _q, ...rest } = buildNav();
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
  it("値を選んでいなければスマートフォルダー名だけを出す", () => {
    const nav = buildNav({ library: { folderId: "fav" } });
    renderBreadcrumbs(nav);

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["お気に入り"]);
    fireEvent.click(screen.getByRole("button", { name: "お気に入り" }));
    expect(nav.goToSegment).toHaveBeenCalledWith(0);
  });

  it("グループの値の作品一覧は「スマートフォルダー名 / 値」で、先頭クリックは値一覧へ戻る操作（goToSegment）", () => {
    const nav = buildNav({ library: { folderId: "by-cv", group: "藤田茜" } });
    renderBreadcrumbs(nav);

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["CV別", "藤田茜"]);
    fireEvent.click(screen.getByRole("button", { name: "CV別" }));
    expect(nav.goToSegment).toHaveBeenCalledWith(0);
  });

  it("値をクリックすると兄弟の値のドロップダウンが開き、選ぶと selectGroupValue を呼ぶ", async () => {
    const api = mockApi({
      "GET /api/tag-prefixes": [],
      "POST /api/smart-folders/:id/groups": [
        buildAxisFacetItem({ value: "藤田茜", count: 4 }),
        buildAxisFacetItem({ value: "天音かなで", count: 3 }),
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
      expect(api.requestsTo("POST /api/smart-folders/:id/groups")).toHaveLength(1),
    );
    expect(api.requestsTo("POST /api/smart-folders/:id/groups")[0]?.body).toEqual({
      groupBy: { kind: "prefix", prefix: "cv" },
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 260, height: 260 });
    });

    fireEvent.click(await screen.findByRole("button", { name: /^天音かなで ?3/ }));
    expect(nav.selectGroupValue).toHaveBeenCalledWith("天音かなで");
    sizeMock.restore();
  });

  it("スマートフォルダー一覧が無い間は、仮の「すべて」を出さず空にする", () => {
    for (const foldersStatus of ["pending", "error"] as const) {
      const { container, unmount } = renderBreadcrumbs({
        foldersStatus,
        refetchFolders: vi.fn(),
        selectedWorkId: null,
        isPending: false,
        ...buildNavActions(),
      });
      expect(screen.queryByRole("button", { name: "すべて" })).toBeNull();
      expect(container.querySelectorAll(".mle-crumbs__seg")).toHaveLength(0);
      unmount();
    }
  });
});
