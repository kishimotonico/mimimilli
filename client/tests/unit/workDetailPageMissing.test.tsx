// 作品詳細の作品が404なら置き換えでライブラリへ戻り、5xx では留まる。
import { render, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouteAtom } from "../../src/entities/navigation/model/appRouteStore";
import WorkDetailPage from "../../src/features/library/ui/WorkDetailPage";
import { apiError, mockApi } from "../helpers/api";
import { seedAppMode } from "../helpers/route";

vi.mock("../../src/features/library/model/useLibraryNavigation", () => ({
  useLibraryNavigation: () => ({ foldersStatus: "loading", clickTag: vi.fn() }),
}));
vi.mock("../../src/features/library/model/useLibraryQueries", () => ({
  useLibraryWorkPatchMutations: () => ({}),
}));

const KEY = "GET /api/works/:id";

function renderPage(reply: Response) {
  mockApi({ [KEY]: () => reply, "GET /api/tags": [] });
  const store = createStore();
  seedAppMode(store, { workDetail: "work-a" });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={store}>
        <WorkDetailPage />
      </JotaiProvider>
    </QueryClientProvider>,
  );
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("存在しない作品の詳細", () => {
  it("404 ならライブラリへ戻る", async () => {
    const store = renderPage(apiError(404, "not_found"));

    await waitFor(() => expect(store.get(appRouteAtom).mode).toBe("library"));
  });

  it("5xx では作品詳細に留まる", async () => {
    const store = renderPage(apiError(500, "internal"));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(store.get(appRouteAtom)).toMatchObject({ mode: "workDetail", workId: "work-a" });
  });
});
