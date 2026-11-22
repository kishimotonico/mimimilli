import { createElement } from "react";
import { act, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { PlayerRuntimeProvider } from "../../src/entities/player/model/PlayerRuntimeProvider";
import LibraryView from "../../src/features/library/ui/LibraryView";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { libraryRouteAtom } from "../../src/entities/library/model/navigationAtoms";
import { mockApi } from "../helpers/api";
import { appShellRoutes } from "../helpers/appShellApi";
import { buildWork, buildWorkListItem, buildWorksPage } from "../helpers/builders";
import { seedLibraryRoute } from "../helpers/route";

describe("LibraryView: 0件の画面から選択つきのエントリーへ戻る", () => {
  it("前の画面の「0件」を引きずって、戻った先の選択を外さない", async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const work = buildWork({ id: "w1", title: "作品1" });
    mockApi(
      appShellRoutes({
        "GET /api/smart-folders/:id/works": async ({ url }) => {
          if (url.searchParams.get("q") === "zzz") return buildWorksPage();
          await held;
          return buildWorksPage([buildWorkListItem({ id: "w1" })]);
        },
        "GET /api/works/:id": work,
      }),
    );
    const store = createStore();
    seedLibraryRoute(store, { folderId: "all", q: "zzz", sort: "added-desc" });
    render(
      createElement(
        QueryClientProvider,
        { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        createElement(
          JotaiProvider,
          { store },
          createElement(
            PlayerRuntimeProvider,
            null,
            createElement(
              LibraryNavigationProvider,
              null,
              createElement(LibraryView, { dockedBarActive: false }),
            ),
          ),
        ),
      ),
    );
    await screen.findByRole("button", { name: "検索をクリア" });

    act(() => seedLibraryRoute(store, { q: "", selectedWorkId: "w1" }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(store.get(libraryRouteAtom).selectedWorkId).toBe("w1");
    release();
  });
});
