import { describe, expect, it } from "vitest";
import type { Condition, SmartFolder } from "@mimimilli/shared";
import { buildSidebarRows } from "../../src/features/library/model/sidebarRows";
import {
  conditionRowText,
  duplicateDraft,
  withGroupBy,
  groupByOptions,
  missingTemplates,
  reorderIds,
  withoutRootChild,
} from "../../src/features/library/model/smartFolderEditing";
import { defaultSmartFolders } from "../helpers/smartFolders";

describe("reorderIds", () => {
  const ids = ["a", "b", "c", "d"];

  it("前・後ろへ動かす", () => {
    expect(reorderIds(ids, "d", "b", "reorder-before")).toEqual(["a", "d", "b", "c"]);
    expect(reorderIds(ids, "a", "c", "reorder-after")).toEqual(["b", "c", "a", "d"]);
  });

  it("位置が変わらないときは null", () => {
    expect(reorderIds(ids, "b", "c", "reorder-before")).toBeNull();
    expect(reorderIds(ids, "c", "b", "reorder-after")).toBeNull();
    expect(reorderIds(ids, "a", "a", "reorder-after")).toBeNull();
  });
});

describe("条件の行", () => {
  const children: Condition[] = [
    { type: "tag", tag: "cv/霧島レイ" },
    { type: "not", child: { type: "tag", tag: "耳かき" } },
    { type: "or", children: [{ type: "hasError" }, { type: "bookmarked" }] },
    {
      type: "not",
      child: { type: "or", children: [{ type: "played" }, { type: "added", withinDays: 7 }] },
    },
    { type: "duration", op: "lte", sec: 3600 },
  ];

  it("人が読める1行にする", () => {
    expect(children.map(conditionRowText)).toEqual([
      "cv/霧島レイ を含む",
      "耳かき を含まない",
      "エラーあり または お気に入り",
      "どれでもない: 再生したことがある、7日以内に追加",
      "60分以下",
    ]);
  });

  it("長さの否定は以上・以下を保ち、末尾で一度だけ否定する", () => {
    const text = (op: "gte" | "lte") =>
      conditionRowText({ type: "not", child: { type: "duration", op, sec: 3600 } });
    expect(text("gte")).toBe("60分以上ではない");
    expect(text("lte")).toBe("60分以下ではない");
  });

  it("まとまりはまとまりごと外れる", () => {
    const condition: Condition = { type: "and", children };
    expect(withoutRootChild(condition, 2)).toEqual({
      type: "and",
      children: [children[0], children[1], children[3], children[4]],
    });
  });
});

describe("追加・複製", () => {
  it("消した既定も候補に出る", () => {
    const folders = defaultSmartFolders().filter((folder) => folder.id !== "by-tag");
    const ids = missingTemplates(folders).map((template) => template.id);
    expect(ids).toEqual(["by-tag", "by-series", "by-rating"]);
  });

  it("複製は元の定義と既定の並びをそのまま写す", () => {
    const random = defaultSmartFolders().find((folder) => folder.id === "random")!;
    const draft = duplicateDraft({ ...random, condition: random.condition! });
    expect(draft).toEqual({
      name: "ランダム（コピー）",
      condition: random.condition,
      sort: "random",
      groupBy: null,
      groupSort: null,
    });
    const fav = defaultSmartFolders().find((folder) => folder.id === "fav")!;
    expect(duplicateDraft({ ...fav, condition: fav.condition! }).sort).toBeNull();
  });

  it("グループ分けのあるものの複製は値の並びも写し、グループ分けを変えた下書きは初期値に戻す", () => {
    const byYear = defaultSmartFolders().find((folder) => folder.id === "by-year")!;
    const copy = duplicateDraft({ ...byYear, condition: byYear.condition! });
    expect(copy.groupSort).toBe("name-desc");
    expect(withGroupBy(copy, { kind: "tag" }, copy).groupSort).toBe("count-desc");
    expect(withGroupBy(copy, { kind: "addedYear" }, copy).groupSort).toBe("name-desc");
    expect(withGroupBy(copy, null, copy)).toMatchObject({ groupBy: null, groupSort: null });
  });

  it("別のグループ分けへ切り替えて開いたときのグループ分けへ戻すと、保存済みの値の並びに戻る", () => {
    const initial = {
      groupBy: { kind: "prefix", prefix: "cv" } as const,
      groupSort: "last-played" as const,
    };
    const draft = { ...duplicateDraft(defaultSmartFolders()[0] as never), ...initial };

    const toYear = withGroupBy(draft, { kind: "addedYear" }, initial);
    expect(toYear.groupSort).toBe("name-desc");

    const back = withGroupBy(toYear, { kind: "prefix", prefix: "cv" }, initial);
    expect(back.groupSort).toBe("last-played");

    const none = withGroupBy(back, null, initial);
    expect(withGroupBy(none, { kind: "prefix", prefix: "cv" }, initial).groupSort).toBe(
      "last-played",
    );
  });

  it("グループ分けの選択肢は定義済みの prefix 全部・タグ・追加年で、ラベルは getGroupByLabel と同じ", () => {
    const prefixes = [
      { prefix: "cv", label: "CV" },
      { prefix: "サークル", label: "サークル" },
    ] as never;
    const options = groupByOptions(prefixes, null);
    expect(options.map((o) => o.key)).toEqual(["prefix:cv", "prefix:サークル", "tag", "addedYear"]);
    expect(options.map((o) => o.label)).toEqual(["CV", "サークル", "タグ", "追加年"]);
  });

  it("今のグループ分けが定義に無い prefix なら、タグの前に足す", () => {
    const options = groupByOptions([] as never, { kind: "prefix", prefix: "気分" });
    expect(options.map((o) => [o.key, o.label])).toEqual([
      ["prefix:気分", "気分"],
      ["tag", "タグ"],
      ["addedYear", "追加年"],
    ]);
  });
});

describe("buildSidebarRows", () => {
  const folders: SmartFolder[] = defaultSmartFolders();

  it("0件のエラーも行を残し、件数の赤い丸は出さない。ほかの行の0は出す", () => {
    const rows = buildSidebarRows(folders, { error: 0, fav: 0, recent: 3 });
    expect(rows).toHaveLength(folders.length);
    const error = rows.find((r) => r.id === "error")!;
    expect(error.count).toBeNull();
    expect(error.countTone).toBe("error");
    expect(rows.find((r) => r.id === "fav")?.count).toBe(0);
    expect(rows.find((r) => r.id === "recent")?.count).toBe(3);
  });

  it("エラーが1件以上なら赤い丸で件数を出す", () => {
    const error = buildSidebarRows(folders, { error: 2 }).find((r) => r.id === "error")!;
    expect(error.count).toBe(2);
    expect(error.countTone).toBe("error");
  });

  it("条件が空・グループ分けありの行は件数を出さない", () => {
    const rows = buildSidebarRows(folders, { all: 9, "by-cv": 9 });
    expect(rows.find((r) => r.id === "all")?.count).toBeNull();
    expect(rows.find((r) => r.id === "by-cv")?.count).toBeNull();
  });
});
