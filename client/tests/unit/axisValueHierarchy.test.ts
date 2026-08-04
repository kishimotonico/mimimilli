import { describe, expect, it } from "vitest";
import type { AxisFacetItem } from "@mimimilli/shared";
import {
  buildAxisValueHierarchy,
  flattenAxisValueRows,
} from "../../src/features/library/model/axisValueHierarchy";

function makeItem(value: string, overrides: Partial<AxisFacetItem> = {}): AxisFacetItem {
  return { value, count: 1, durationSec: 0, covers: [], ...overrides };
}

describe("buildAxisValueHierarchy", () => {
  it("スラッシュ複数のタグをインデント＋葉ラベルの階層にする", () => {
    const rows = buildAxisValueHierarchy([makeItem("シチュ/学園/図書室")]);

    expect(rows).toEqual([
      { kind: "heading", depth: 0, path: "シチュ", label: "シチュ" },
      { kind: "heading", depth: 1, path: "シチュ/学園", label: "学園" },
      {
        kind: "value",
        depth: 2,
        path: "シチュ/学園/図書室",
        label: "図書室",
        item: makeItem("シチュ/学園/図書室"),
      },
    ]);
  });

  it("実際にタグとして存在する中間ノードは配下の見出しを兼ねる選択可能な値になる", () => {
    const rows = buildAxisValueHierarchy([
      makeItem("シチュ/学園", { count: 3 }),
      makeItem("シチュ/学園/図書室", { count: 1 }),
    ]);

    expect(rows).toEqual([
      { kind: "heading", depth: 0, path: "シチュ", label: "シチュ" },
      {
        kind: "value",
        depth: 1,
        path: "シチュ/学園",
        label: "学園",
        item: makeItem("シチュ/学園", { count: 3 }),
      },
      {
        kind: "value",
        depth: 2,
        path: "シチュ/学園/図書室",
        label: "図書室",
        item: makeItem("シチュ/学園/図書室", { count: 1 }),
      },
    ]);
  });

  it("スラッシュを含まないフラットなタグは depth 0 の選択可能な値になる", () => {
    const rows = buildAxisValueHierarchy([makeItem("癒し系")]);

    expect(rows).toEqual([
      { kind: "value", depth: 0, path: "癒し系", label: "癒し系", item: makeItem("癒し系") },
    ]);
  });

  it("兄弟は名前順（direction）で並ぶ", () => {
    const rows = buildAxisValueHierarchy([makeItem("b"), makeItem("a"), makeItem("c")], "asc");
    expect(rows.map((r) => r.label)).toEqual(["a", "b", "c"]);

    const desc = buildAxisValueHierarchy([makeItem("b"), makeItem("a"), makeItem("c")], "desc");
    expect(desc.map((r) => r.label)).toEqual(["c", "b", "a"]);
  });

  it("4階層以上でも破綻しない", () => {
    const rows = buildAxisValueHierarchy([makeItem("a/b/c/d/e")]);

    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 3, 4]);
    expect(rows.map((r) => r.kind)).toEqual(["heading", "heading", "heading", "heading", "value"]);
    expect(rows[4]).toMatchObject({ label: "e", path: "a/b/c/d/e" });
  });

  it("兄弟間で異なる子を持つ枝が混ざっても正しく分岐する", () => {
    const rows = buildAxisValueHierarchy([
      makeItem("シチュ/学園/図書室"),
      makeItem("シチュ/学園/屋上"),
      makeItem("シチュ/職場"),
    ]);

    expect(rows.map((r) => `${r.kind}:${r.path}`)).toEqual([
      "heading:シチュ",
      "heading:シチュ/学園",
      "value:シチュ/学園/屋上",
      "value:シチュ/学園/図書室",
      "value:シチュ/職場",
    ]);
  });
});

describe("flattenAxisValueRows", () => {
  it("全行を depth=0・kind=value にする（件数・総時間ソート用のフォールバック）", () => {
    const items = [makeItem("シチュ/学園/図書室"), makeItem("癒し系")];
    const rows = flattenAxisValueRows(items);

    expect(rows).toEqual([
      {
        kind: "value",
        depth: 0,
        path: "シチュ/学園/図書室",
        label: "シチュ/学園/図書室",
        item: items[0],
      },
      { kind: "value", depth: 0, path: "癒し系", label: "癒し系", item: items[1] },
    ]);
  });
});
