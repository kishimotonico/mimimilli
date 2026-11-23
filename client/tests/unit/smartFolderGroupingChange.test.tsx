import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";
import { libraryRouteAtom } from "../../src/entities/library/model/navigationAtoms";
import { getSmartFolderWorks } from "../../src/entities/smart-folder/api";
import {
  folderWorksKey,
  folderWorksParams,
} from "../../src/features/library/model/folderWorksRequest";
import { useLibraryView } from "../../src/features/library/model/useLibraryNavigation";
import { useSmartFolderEditor } from "../../src/features/library/model/useSmartFolderEditor";
import { mockApi } from "../helpers/api";
import { buildWorksPage } from "../helpers/builders";
import { seedLibraryRoute } from "../helpers/route";
import {
  buildSmartFolder,
  createSmartFolderQueryClient,
  defaultSmartFolders,
} from "../helpers/smartFolders";
import { nts } from "../helpers/tag";

const BY_ID = "by-circle";
const byCircle = buildSmartFolder({
  id: BY_ID,
  name: "サークル別",
  groupBy: { kind: "prefix", prefix: "circle" },
});
const byYear = {
  ...byCircle,
  groupBy: { kind: "addedYear" as const },
  groupSort: "name-asc" as const,
};

// 開いている作品一覧（グループの値つき）が、グループ分けの変更の保存で古い group のまま取り直されないこと
describe("グループ分けを変えた保存", () => {
  it("古い group での作品一覧の取得が1回も出ずに値一覧へ移り、チップ・検索語・並びは残る", async () => {
    const api = mockApi({
      "GET /api/smart-folders": [...defaultSmartFolders(), byCircle],
      "GET /api/smart-folders/:id/works": () => buildWorksPage(),
      "GET /api/smart-folders/:id/groups": [],
      "PATCH /api/smart-folders/:id": () => ({ ...byYear }),
    });
    const store = createStore();
    seedLibraryRoute(store, {
      folderId: BY_ID,
      group: "サークルA",
      selectedTags: nts(["ASMR"]),
      q: "雨",
      sort: "title-asc",
    });
    const queryClient = createSmartFolderQueryClient([...defaultSmartFolders(), byCircle]);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(Provider, { store }, children),
      );
    const { result } = renderHook(
      () => {
        const nav = useLibraryView();
        const editor = useSmartFolderEditor();
        const view = nav.foldersStatus === "ready" && nav.view.kind === "works" ? nav.view : null;
        useQuery({
          queryKey: view ? folderWorksKey(view, view.q) : ["idle"],
          queryFn: () =>
            getSmartFolderWorks(view!.folder.id, {
              ...folderWorksParams(view!, view!.q),
              page: 1,
              limit: 50,
            }),
          enabled: view !== null,
        });
        return { nav, editor };
      },
      { wrapper },
    );
    await waitFor(() => expect(api.requestsTo("GET /api/smart-folders/:id/works")).toHaveLength(1));
    expect(
      api.requestsTo("GET /api/smart-folders/:id/works")[0]!.url.searchParams.get("group"),
    ).toBe("サークルA");

    await result.current.editor.patch(BY_ID, { groupBy: byYear.groupBy });

    await waitFor(() => expect(result.current.nav.foldersStatus).toBe("ready"));
    expect(store.get(libraryRouteAtom)).toMatchObject({
      folderId: BY_ID,
      group: null,
      selectedTags: ["ASMR"],
      q: "雨",
      sort: "title-asc",
    });
    const worksRequests = api.requestsTo("GET /api/smart-folders/:id/works");
    expect(worksRequests).toHaveLength(1);
    const view = result.current.nav.foldersStatus === "ready" ? result.current.nav.view : null;
    expect(view?.kind).toBe("value-list");
  });
});
