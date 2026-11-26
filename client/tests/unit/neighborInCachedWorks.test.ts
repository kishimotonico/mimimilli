import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { folderWorksKey } from "../../src/features/library/model/folderWorksRequest";
import { neighborInCachedWorks } from "../../src/features/library/model/neighborInCachedWorks";
import { buildWorkListItem, buildWorksPage } from "../helpers/builders";
import { buildNav } from "./fixtures/libraryNav";

const nav = buildNav();
const view = nav.view as Extract<typeof nav.view, { kind: "works" }>;

function seed(pages: string[][]) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(folderWorksKey(view, ""), {
    pages: pages.map((ids) =>
      buildWorksPage(ids.map((id) => buildWorkListItem({ id, title: id }))),
    ),
    pageParams: pages.map((_, index) => ({ page: index + 1 })),
  });
  return queryClient;
}

describe("neighborInCachedWorks", () => {
  it("ページをまたいで、次の作品を返す", () => {
    const queryClient = seed([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(neighborInCachedWorks(queryClient, view, "", "b")).toBe("c");
  });

  it("末尾なら前の作品を返す", () => {
    const queryClient = seed([["a", "b"], ["c"]]);
    expect(neighborInCachedWorks(queryClient, view, "", "c")).toBe("b");
  });

  it("作品が見つからない、キャッシュが無い、works 以外の一覧のときは null", () => {
    const queryClient = seed([["a", "b"]]);
    expect(neighborInCachedWorks(queryClient, view, "", "x")).toBeNull();
    expect(neighborInCachedWorks(new QueryClient(), view, "", "a")).toBeNull();
    expect(
      neighborInCachedWorks(queryClient, { ...view, kind: "value-list" } as never, "", "a"),
    ).toBeNull();
    expect(neighborInCachedWorks(queryClient, null, "", "a")).toBeNull();
  });
});
