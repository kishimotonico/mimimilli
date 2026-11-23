import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { Condition, SmartFolder } from "@mimimilli/shared";
import { resolveLibraryView } from "../../src/entities/library/resolveLibraryView";
import { createInitialAppRoute } from "../../src/entities/navigation/model/appRoute";
import {
  folderWorksParams,
  folderWorksResetKey,
} from "../../src/features/library/model/folderWorksRequest";
import { bookmarkActiveListHandler } from "../../src/features/library/model/workPatchInvalidation";
import { nt } from "../helpers/tag";
import { buildSmartFolder, defaultSmartFolders } from "../helpers/smartFolders";

const tag = (value: string): Condition => ({ type: "tag", tag: value });
const bookmarked: Condition = { type: "bookmarked" };

function handlerFor(condition: Condition) {
  const folder: SmartFolder = buildSmartFolder({ id: "sf-x", condition });
  const view = resolveLibraryView({ ...createInitialAppRoute().library, folderId: "sf-x" }, [
    ...defaultSmartFolders(),
    folder,
  ]);
  return bookmarkActiveListHandler(view, "");
}

async function applyBookmark(condition: Condition) {
  const handler = handlerFor(condition);
  const queryClient = new QueryClient();
  const reset = vi.spyOn(queryClient, "resetQueries").mockResolvedValue();
  await handler?.apply(queryClient, { workId: "w1", bookmarked: true });
  return reset.mock.calls.length;
}

describe("bookmarkActiveListHandler: 条件がお気に入りに依存するか", () => {
  it("bookmarked を直接含む条件は一覧を reset する", async () => {
    expect(await applyBookmark({ type: "and", children: [bookmarked] })).toBe(1);
  });

  it("or の中の bookmarked も見つける", async () => {
    const condition: Condition = {
      type: "and",
      children: [{ type: "or", children: [tag("a"), bookmarked] }],
    };
    expect(await applyBookmark(condition)).toBe(1);
  });

  it("not(or(bookmarked)) のように入れ子の下にある bookmarked も見つける", async () => {
    const condition: Condition = {
      type: "and",
      children: [{ type: "not", child: { type: "or", children: [bookmarked, tag("a")] } }],
    };
    expect(await applyBookmark(condition)).toBe(1);
  });

  it("bookmarked を含まない入れ子の条件は reset せず該当行だけパッチする", async () => {
    const condition: Condition = {
      type: "and",
      children: [
        { type: "or", children: [tag("a"), tag("b")] },
        { type: "not", child: tag("c") },
      ],
    };
    expect(await applyBookmark(condition)).toBe(0);
  });

  it("値一覧は一覧を引き受けない", () => {
    const grouped = buildSmartFolder({ id: "sf-g", groupBy: { kind: "tag" } });
    const view = resolveLibraryView({ ...createInitialAppRoute().library, folderId: "sf-g" }, [
      ...defaultSmartFolders(),
      grouped,
    ]);
    expect(bookmarkActiveListHandler(view, "")).toBeNull();
  });
});

describe("folderWorksParams: 検索語", () => {
  it("前後の空白を落とした正規形を要求とキーに使う", () => {
    const view = resolveLibraryView(
      { ...createInitialAppRoute().library, folderId: "fav", q: " 藤田 " },
      defaultSmartFolders(),
    );
    if (view.kind !== "works") throw new Error("works ではありません");

    expect(folderWorksParams(view, " 藤田 ").q).toBe("藤田");
    expect(folderWorksParams(view, "  ").q).toBe("");
  });
});

describe("folderWorksResetKey", () => {
  const grouped = buildSmartFolder({
    id: "sf-grouped",
    groupBy: { kind: "prefix", prefix: "cv" },
  });
  const worksView = (patch: Partial<ReturnType<typeof createInitialAppRoute>["library"]>) => {
    const view = resolveLibraryView(
      { ...createInitialAppRoute().library, folderId: "all", sort: "added-desc", ...patch },
      [...defaultSmartFolders(), grouped],
    );
    if (view.kind !== "works") throw new Error("works ではありません");
    return view;
  };
  const base = worksView({ selectedTags: [nt("ASMR")] });

  it("同じ入力なら同じキー。検索語は正規形で比べる", () => {
    expect(folderWorksResetKey(base, "x")).toBe(folderWorksResetKey({ ...base }, " x "));
  });

  it("random の seed が違えばキーが変わる", () => {
    const random = (seed: number) => worksView({ sort: "random", seed });
    expect(folderWorksResetKey(random(1), "")).not.toBe(folderWorksResetKey(random(2), ""));
    expect(folderWorksResetKey(random(1), "")).toBe(folderWorksResetKey(random(1), ""));
  });

  it("グループの値が違えばキーが変わる", () => {
    const inGroup = (group: string) => worksView({ folderId: "sf-grouped", group });
    expect(folderWorksResetKey(inGroup("藤田茜"), "")).not.toBe(
      folderWorksResetKey(inGroup("霧島レイ"), ""),
    );
  });

  it.each([
    ["フォルダー", worksView({ folderId: "fav" }), ""],
    ["チップ", worksView({}), ""],
    ["解決済みの並び", worksView({ selectedTags: [nt("ASMR")], sort: "title-asc" }), ""],
    ["検索語", base, "x"],
  ])("%sが変わるとキーが変わる", (_label, view, q) => {
    expect(folderWorksResetKey(view, q)).not.toBe(folderWorksResetKey(base, ""));
  });
});
