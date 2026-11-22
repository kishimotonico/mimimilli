import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WorkDetailBreadcrumbs from "../../src/features/library/ui/WorkDetailBreadcrumbs";
import { LibraryNavigationContext } from "../../src/features/library/model/libraryNavigationContext";
import { navigateAtom, appModeAtom } from "../../src/entities/navigation/model/appRouteStore";
import { createInitialAppRoute } from "../../src/entities/navigation/model/appRoute";
import { apiError, mockApi } from "../helpers/api";
import { buildNav } from "./fixtures/libraryNav";

beforeEach(() => {
  mockApi({ "GET /api/works/:id": () => apiError(500, "internal", "失敗") });
});

afterEach(cleanup);

function renderCrumbs(nav: ReturnType<typeof buildNav>) {
  const store = createStore();
  store.set(navigateAtom, { ...createInitialAppRoute(), mode: "workDetail", workId: "w1" });
  render(
    createElement(
      QueryClientProvider,
      { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
      createElement(
        Provider,
        { store },
        createElement(
          LibraryNavigationContext.Provider,
          { value: nav },
          createElement(WorkDetailBreadcrumbs),
        ),
      ),
    ),
  );
  return store;
}

describe("WorkDetailBreadcrumbs", () => {
  it("「ライブラリ」は「すべて」へ入り直す", () => {
    const nav = buildNav({ library: { folderId: "by-cv", group: "藤田茜" } });
    renderCrumbs(nav);

    fireEvent.click(screen.getByRole("button", { name: "ライブラリ" }));
    expect(nav.openFolder).toHaveBeenCalledWith("all");
  });

  it("グループの値があるときのスマートフォルダー名は値一覧へ戻り、値は保持している一覧へ戻る", () => {
    const nav = buildNav({ library: { folderId: "by-cv", group: "藤田茜" } });
    const store = renderCrumbs(nav);

    fireEvent.click(screen.getByRole("button", { name: "CV別" }));
    expect(nav.goToSegment).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole("button", { name: "藤田茜" }));
    expect(store.get(appModeAtom)).toBe("library");
  });

  it("グループ分けを持たないスマートフォルダー名は保持している状態のまま一覧へ戻る", () => {
    const nav = buildNav({ library: { folderId: "fav" } });
    const store = renderCrumbs(nav);

    fireEvent.click(screen.getByRole("button", { name: "お気に入り" }));
    expect(nav.goToSegment).not.toHaveBeenCalled();
    expect(store.get(appModeAtom)).toBe("library");
  });
});
