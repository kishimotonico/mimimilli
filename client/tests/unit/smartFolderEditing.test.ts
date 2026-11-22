import { describe, expect, it } from "vitest";
import type { Condition, SmartFolder } from "@mimimilli/shared";
import { buildSidebarRows } from "../../src/features/library/model/sidebarRows";
import {
  conditionRowText,
  duplicateDraft,
  groupByOptions,
  missingTemplates,
  reorderIds,
  smartFolderPermissions,
  withoutRootChild,
} from "../../src/features/library/model/smartFolderEditing";
import { buildSmartFolder, defaultSmartFolders } from "../helpers/smartFolders";

describe("smartFolderPermissions", () => {
  const byId = (id: string) => defaultSmartFolders().find((folder) => folder.id === id)!;

  it("自作は何でも変えられる", () => {
    expect(smartFolderPermissions(buildSmartFolder())).toEqual({
      rename: true,
      editCondition: true,
      editGroupBy: true,
      inheritSort: true,
      remove: true,
      edit: true,
    });
  });

  it("既定は名前・並び・削除だけ。条件とグループ分けは変えられない", () => {
    const permissions = smartFolderPermissions(byId("by-cv"));
    expect(permissions).toMatchObject({
      rename: true,
      editCondition: false,
      editGroupBy: false,
      remove: true,
    });
  });

  it("「すべて」は名前・条件・グループ分け・削除ができず、並びを継承にもできない", () => {
    expect(smartFolderPermissions(byId("all"))).toMatchObject({
      rename: false,
      editCondition: false,
      editGroupBy: false,
      inheritSort: false,
      remove: false,
    });
  });

  it("壊れた行は削除だけ", () => {
    const permissions = smartFolderPermissions(buildSmartFolder({ condition: null }));
    expect(permissions).toMatchObject({ edit: false, remove: true, rename: false });
  });
});

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
      "#耳かき を含まない",
      "エラーあり または お気に入り",
      "どれでもない: 再生したことがある、7日以内に追加",
      "60分以下",
    ]);
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
    });
    const fav = defaultSmartFolders().find((folder) => folder.id === "fav")!;
    expect(duplicateDraft({ ...fav, condition: fav.condition! }).sort).toBeNull();
  });

  it("グループ分けの選択肢は定義済みの prefix 全部・全タグ・追加年", () => {
    const options = groupByOptions([{ prefix: "cv" }, { prefix: "サークル" }] as never, null);
    expect(options.map((o) => o.key)).toEqual(["prefix:cv", "prefix:サークル", "tag", "addedYear"]);
  });
});

describe("buildSidebarRows の編集の状態", () => {
  const folders: SmartFolder[] = defaultSmartFolders({ error: 0 });
  const integrity = { status: "ready", count: 0 } as const;

  it("通常は0件のエラーを隠し、編集の状態では薄く見せる", () => {
    expect(buildSidebarRows(folders, "all", integrity).some((r) => r.id === "error")).toBe(false);
    const rows = buildSidebarRows(folders, "all", integrity, true);
    expect(rows.find((r) => r.id === "error")?.dimmed).toBe(true);
    expect(rows).toHaveLength(folders.length);
  });
});
