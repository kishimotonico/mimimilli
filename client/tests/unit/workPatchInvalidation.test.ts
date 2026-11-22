import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { Condition, SmartFolder } from "@mimimilli/shared";
import { resolveLibraryView } from "../../src/entities/library/resolveLibraryView";
import { createInitialAppRoute } from "../../src/entities/navigation/model/appRoute";
import { bookmarkActiveListHandler } from "../../src/features/library/model/workPatchInvalidation";
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

  it("値一覧・読めない行は一覧を引き受けない", () => {
    const broken = buildSmartFolder({ id: "sf-b", condition: null });
    const view = resolveLibraryView({ ...createInitialAppRoute().library, folderId: "sf-b" }, [
      ...defaultSmartFolders(),
      broken,
    ]);
    expect(bookmarkActiveListHandler(view, "")).toBeNull();
  });
});
