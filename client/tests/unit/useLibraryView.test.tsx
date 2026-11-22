import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { libraryRouteAtom } from "../../src/entities/library/model/navigationAtoms";
import { useLibraryView } from "../../src/features/library/model/useLibraryNavigation";
import { mockApi } from "../helpers/api";
import { createSmartFolderQueryClient, defaultSmartFolders } from "../helpers/smartFolders";
import { seedLibraryRoute } from "../helpers/route";
import { nt } from "../helpers/tag";

function setup(patch: Parameters<typeof seedLibraryRoute>[1]) {
  mockApi({ "GET /api/smart-folders": defaultSmartFolders() });
  const store = createStore();
  seedLibraryRoute(store, patch);
  const queryClient = createSmartFolderQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, children),
    );
  return { store, ...renderHook(() => useLibraryView(), { wrapper }) };
}

describe("useLibraryView", () => {
  it("存在しないスマートフォルダーを指す route は、一覧が揃ったら「すべて」へ正規化する。チップ・検索語・並びは保つ", async () => {
    const { store, result } = setup({
      folderId: "sf-gone",
      group: "x",
      selectedTags: [nt("ASMR")],
      q: "藤田",
      sort: "title-asc",
    });

    await waitFor(() => expect(store.get(libraryRouteAtom).folderId).toBe("all"));

    expect(store.get(libraryRouteAtom)).toMatchObject({
      group: null,
      selectedTags: ["ASMR"],
      q: "藤田",
      sort: "title-asc",
    });
    expect(result.current.foldersStatus).toBe("ready");
  });

  it("同じ folderId のまま、グループ分けの無いフォルダーへ group 付きの route が戻ってきたら group を落とす", async () => {
    const { store, result } = setup({ folderId: "fav" });
    await waitFor(() => expect(result.current.foldersStatus).toBe("ready"));

    act(() => seedLibraryRoute(store, { group: "x" }));

    await waitFor(() => expect(store.get(libraryRouteAtom).group).toBeNull());
  });

  it("存在するスマートフォルダーの route は動かさない", async () => {
    const { store, result } = setup({ folderId: "fav" });
    await waitFor(() => expect(result.current.foldersStatus).toBe("ready"));
    expect(store.get(libraryRouteAtom).folderId).toBe("fav");
  });

  it("再描画を待たない連続操作でも、先に積んだチップが消えない", async () => {
    const { store, result } = setup({ folderId: "all" });
    await waitFor(() => expect(result.current.foldersStatus).toBe("ready"));
    const before = result.current;

    act(() => {
      before.clickTag(nt("cv/藤田茜"), { ctrlKey: false, metaKey: false });
      before.addTag(nt("cv/霧島レイ"));
    });

    expect(store.get(libraryRouteAtom).selectedTags).toEqual(["cv/藤田茜", "cv/霧島レイ"]);
  });

  it("操作の参照は view が変わっても変わらず、呼ばれた時点の最新の view を読む", async () => {
    const { store, result } = setup({ folderId: "all" });
    await waitFor(() => expect(result.current.foldersStatus).toBe("ready"));
    const before = result.current;

    act(() => result.current.openFolder("fav"));
    await waitFor(() => expect(store.get(libraryRouteAtom).folderId).toBe("fav"));

    expect(result.current.addTag).toBe(before.addTag);
    expect(result.current.setSearchQuery).toBe(before.setSearchQuery);
    expect(result.current.backToValueList).toBe(before.backToValueList);

    act(() => before.setSearchQuery("藤田"));
    expect(store.get(libraryRouteAtom)).toMatchObject({ folderId: "fav", q: "藤田" });
  });
});
