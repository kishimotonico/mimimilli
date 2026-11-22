import { describe, expect, it } from "vitest";
import { resolveLibraryView } from "../../src/entities/library/resolveLibraryView";
import {
  createInitialAppRoute,
  type LibraryRoute,
} from "../../src/entities/navigation/model/appRoute";
import { buildSmartFolder, defaultSmartFolders } from "../helpers/smartFolders";
import { nts } from "../helpers/tag";

function route(patch: Partial<LibraryRoute> = {}): LibraryRoute {
  return { ...createInitialAppRoute().library, seed: 42, ...patch };
}

const folders = defaultSmartFolders();

function works(view: ReturnType<typeof resolveLibraryView>) {
  if (view.kind !== "works") throw new Error(`作品一覧ではありません: ${view.kind}`);
  return view;
}

describe("resolveLibraryView: 存在しない ID・グループ", () => {
  it("存在しないスマートフォルダー ID は「すべて」の作品一覧になる", () => {
    const view = resolveLibraryView(route({ folderId: "sf-gone", group: "x" }), folders);

    expect(view.folder.id).toBe("all");
    expect(view.kind).toBe("works");
    expect(view.kind === "works" && view.group).toBeNull();
  });

  it("グループ分けの無いフォルダーの group は無視する", () => {
    const view = resolveLibraryView(route({ folderId: "fav", group: "藤田茜" }), folders);

    expect(view).toMatchObject({ kind: "works", group: null, groupBy: null });
    expect(view.breadcrumb).toEqual(["お気に入り"]);
  });

  it("「すべて」が無い一覧は不正としてエラーにする", () => {
    expect(() =>
      resolveLibraryView(
        route(),
        folders.filter((f) => f.id !== "all"),
      ),
    ).toThrow();
  });
});

describe("resolveLibraryView: 検索語", () => {
  it("空白だけの検索語は空として解決する", () => {
    const view = resolveLibraryView(route({ folderId: "fav", q: "  " }), folders);

    expect(view).toMatchObject({ kind: "works", q: "" });
  });
});

describe("resolveLibraryView: 値一覧と作品一覧", () => {
  it("グループ分けを持つフォルダーで group が無ければ値一覧", () => {
    const view = resolveLibraryView(route({ folderId: "by-cv" }), folders);

    expect(view).toMatchObject({
      kind: "value-list",
      groupBy: { kind: "prefix", prefix: "cv" },
      breadcrumb: ["CV別"],
    });
  });

  it("値一覧では q・tags を効かせない（parse では落とさず、ここで無視する）", () => {
    const view = resolveLibraryView(
      route({ folderId: "by-cv", selectedTags: nts(["ASMR"]), q: "藤田" }),
      folders,
    );

    expect(view.kind).toBe("value-list");
    expect(view).not.toHaveProperty("selectedTags");
    expect(view).not.toHaveProperty("q");
  });

  it("グループの値を選ぶと作品一覧になり、チップ・検索語・値・パンくずを返す", () => {
    const view = resolveLibraryView(
      route({ folderId: "by-cv", group: "藤田茜", selectedTags: nts(["ASMR"]), q: "藤田" }),
      folders,
    );

    expect(view).toMatchObject({
      kind: "works",
      group: "藤田茜",
      groupBy: { kind: "prefix", prefix: "cv" },
      selectedTags: ["ASMR"],
      q: "藤田",
      breadcrumb: ["CV別", "藤田茜"],
    });
  });

  it("グループ分けの無いフォルダーではチップと検索語を効かせる", () => {
    const view = resolveLibraryView(
      route({ folderId: "fav", selectedTags: nts(["ASMR"]), q: "x" }),
      folders,
    );

    expect(view).toMatchObject({ kind: "works", selectedTags: ["ASMR"], q: "x" });
  });
});

describe("resolveLibraryView: 条件が読めない行", () => {
  const broken = buildSmartFolder({ id: "sf-broken", name: "壊れた", condition: null });

  it("開けない状態（broken・reason=folder）を返す", () => {
    const view = resolveLibraryView(route({ folderId: "sf-broken" }), [...folders, broken]);

    expect(view).toMatchObject({ kind: "broken", reason: "folder", breadcrumb: ["壊れた"] });
    expect(view.folder.id).toBe("sf-broken");
  });

  it("group があっても broken", () => {
    const view = resolveLibraryView(route({ folderId: "sf-broken", group: "x" }), [
      ...folders,
      broken,
    ]);

    expect(view.kind).toBe("broken");
  });
});

describe("resolveLibraryView: 「すべて」の行が壊れているとき", () => {
  const brokenAll = buildSmartFolder({ id: "all", name: "すべて", condition: null, sort: null });
  const withBrokenAll = folders.map((f) => (f.id === "all" ? brokenAll : f));

  it("固有の並びを持つ正常なスマートフォルダーは開ける", () => {
    const view = resolveLibraryView(route({ folderId: "recent" }), withBrokenAll);

    expect(view).toMatchObject({ kind: "works", sort: "last-played" });
  });

  it("今の並びがあれば、継承するスマートフォルダーも開ける", () => {
    const view = resolveLibraryView(route({ folderId: "fav", sort: "title-asc" }), withBrokenAll);

    expect(view).toMatchObject({ kind: "works", sort: "title-asc" });
  });

  it("並びを継承する作品一覧は、理由つきで開けない状態になる", () => {
    const view = resolveLibraryView(route({ folderId: "fav" }), withBrokenAll);

    expect(view).toMatchObject({ kind: "broken", reason: "sort", breadcrumb: ["お気に入り"] });
  });

  it("値一覧は並びを要さないので開ける", () => {
    expect(resolveLibraryView(route({ folderId: "by-cv" }), withBrokenAll).kind).toBe("value-list");
  });

  it("「すべて」自身は読めない行として開けない状態になる。存在しない ID も同じ", () => {
    expect(resolveLibraryView(route({ folderId: "all" }), withBrokenAll)).toMatchObject({
      kind: "broken",
      reason: "folder",
    });
    expect(resolveLibraryView(route({ folderId: "sf-gone" }), withBrokenAll).folder.id).toBe("all");
  });
});

describe("resolveLibraryView: 並びの解決（今の並び → フォルダーの既定 → 「すべて」の既定）", () => {
  it("今の並びが最優先", () => {
    const view = resolveLibraryView(route({ folderId: "recent", sort: "title-asc" }), folders);

    expect(works(view).sort).toBe("title-asc");
    expect(works(view).sortDeviates).toBe(true);
  });

  it("今の並びが無ければフォルダーの既定の並び", () => {
    const view = resolveLibraryView(route({ folderId: "recent" }), folders);

    expect(works(view).sort).toBe("last-played");
    expect(works(view).sortDeviates).toBe(false);
  });

  it("フォルダーの既定が null（「すべて」と同じ）なら「すべて」の既定に従う", () => {
    const changedAll = folders.map((f) =>
      f.id === "all" ? { ...f, sort: "title-desc" as const } : f,
    );

    expect(works(resolveLibraryView(route({ folderId: "fav" }), folders)).sort).toBe("added-desc");
    expect(works(resolveLibraryView(route({ folderId: "fav" }), changedAll)).sort).toBe(
      "title-desc",
    );
  });

  it("今の並びが解決後の既定と同じなら外れていない（メニューに保存を出さない）", () => {
    expect(
      works(resolveLibraryView(route({ folderId: "fav", sort: "added-desc" }), folders))
        .sortDeviates,
    ).toBe(false);
    expect(
      works(resolveLibraryView(route({ folderId: "fav", sort: "title-asc" }), folders))
        .sortDeviates,
    ).toBe(true);
  });

  it("今の並びが null なら外れない", () => {
    expect(
      works(resolveLibraryView(route({ folderId: "all", sort: null }), folders)).sortDeviates,
    ).toBe(false);
  });
});

describe("resolveLibraryView: seed", () => {
  it("解決後の並びが random のときだけ seed を渡す（今の並びで random にした場合）", () => {
    const view = resolveLibraryView(route({ folderId: "all", sort: "random", seed: 7 }), folders);

    expect(view.kind === "works" && view.seed).toBe(7);
  });

  it("フォルダーの既定が random のとき（ランダム）も seed を渡す", () => {
    const view = resolveLibraryView(route({ folderId: "random", seed: 9 }), folders);

    expect(view.kind === "works" && view.seed).toBe(9);
  });

  it("random でなければ seed は undefined", () => {
    const view = resolveLibraryView(route({ folderId: "all", seed: 9 }), folders);

    expect(view.kind === "works" && view.seed).toBeUndefined();
  });

  it("今の並びで random 以外へ外れたら、既定が random でも seed は渡さない", () => {
    const view = resolveLibraryView(
      route({ folderId: "random", sort: "title-asc", seed: 9 }),
      folders,
    );

    expect(view.kind === "works" && view.seed).toBeUndefined();
  });
});
