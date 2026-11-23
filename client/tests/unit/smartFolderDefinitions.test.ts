import { describe, expect, it } from "vitest";
import type { Condition, GroupBy, SortId, TagPrefix } from "@mimimilli/shared";
import {
  buildGroupByRows,
  getGroupByIcon,
  getGroupByLabel,
  getSmartFolderIcon,
} from "../../src/entities/library/smartFolderDefinitions";

const PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: null, protected: true },
  { prefix: "サークル", label: "サークル", color: null, protected: true },
];

describe("smartFolderDefinitions", () => {
  it("labels groupBy from prefix definitions and falls back to the raw prefix", () => {
    expect(getGroupByLabel({ kind: "prefix", prefix: "サークル" }, PREFIXES)).toBe("サークル");
    expect(getGroupByLabel({ kind: "prefix", prefix: "cv" }, PREFIXES)).toBe("CV");
    expect(getGroupByLabel({ kind: "prefix", prefix: "気分" }, PREFIXES)).toBe("気分"); // 未登録は prefix をそのまま
    expect(getGroupByLabel({ kind: "tag" })).toBe("タグ");
    expect(getGroupByLabel({ kind: "addedYear" })).toBe("追加年");
  });

  it("buildGroupByRows は定義済みの prefix 全部（定義順）＋タグ＋追加年（ADR-0041「＋絞り込み」）", () => {
    const rows = buildGroupByRows(PREFIXES);
    expect(rows.map((r) => r.groupBy)).toEqual([
      { kind: "prefix", prefix: "cv" },
      { kind: "prefix", prefix: "サークル" },
      { kind: "tag" },
      { kind: "addedYear" },
    ]);
    expect(rows[0]).toEqual({ groupBy: { kind: "prefix", prefix: "cv" }, name: "CV" });
    expect(rows.at(-1)).toEqual({ groupBy: { kind: "addedYear" }, name: "追加年" });
  });

  it("getSmartFolderIcon はグループ分けから、ないものは条件の形から引く。ID は見ない", () => {
    const and = (...children: Condition[]): Condition => ({ type: "and", children });
    const folder = (
      condition: Condition,
      options: { sort?: SortId | null; groupBy?: GroupBy | null } = {},
    ) => ({ condition, sort: options.sort ?? null, groupBy: options.groupBy ?? null });
    expect(getSmartFolderIcon(folder(and({ type: "bookmarked" })))).toBe("star");
    expect(getSmartFolderIcon(folder(and({ type: "hasError" })))).toBe("err");
    expect(getSmartFolderIcon(folder(and({ type: "played" })))).toBe("clock");
    expect(getSmartFolderIcon(folder(and({ type: "added", withinDays: 30 })))).toBe("add");
    expect(getSmartFolderIcon(folder(and({ type: "bookmarked" }, { type: "hasError" })))).toBe(
      "funnel",
    );
    expect(getSmartFolderIcon(folder(and()))).toBe("grid");
    expect(getSmartFolderIcon(folder(and(), { sort: "added-desc" }))).toBe("grid");
    expect(getSmartFolderIcon(folder(and(), { sort: "random" }))).toBe("shuffle");
    expect(getSmartFolderIcon(folder(and({ type: "bookmarked" }), { sort: "random" }))).toBe(
      "star",
    );
    expect(
      getSmartFolderIcon(folder(and(), { groupBy: { kind: "prefix", prefix: "サークル" } })),
    ).toBe("house");
    expect(
      getSmartFolderIcon(
        folder(and({ type: "bookmarked" }), { groupBy: { kind: "prefix", prefix: "気分" } }),
      ),
    ).toBe("folder");
    expect(getSmartFolderIcon(folder(and(), { groupBy: { kind: "addedYear" } }))).toBe("calendar");
  });

  it("値一覧の既定アイコンはサイドバーの行と同じ表から引く", () => {
    expect(getGroupByIcon({ kind: "prefix", prefix: "カテゴリ" })).toBe("steps");
    expect(getGroupByIcon({ kind: "tag" })).toBe("tag");
  });
});
