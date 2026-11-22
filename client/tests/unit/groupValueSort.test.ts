import { describe, expect, it } from "vitest";
import {
  GROUP_SORT_OPTIONS,
  groupSortColumn,
  groupSortDirection,
  isNameSort,
  toggleGroupSortColumn,
} from "../../src/features/library/model/groupValueSort";
import { buildGroupValueDisplayRows } from "../../src/features/library/model/groupValueDisplayRows";
import type { GroupValueItem } from "@mimimilli/shared";

function item(value: string): GroupValueItem {
  return {
    value,
    sortKey: value,
    lastAddedAt: "2026-01-01T00:00:00.000Z",
    lastPlayedAt: null,
    count: 1,
    durationSec: 0,
    covers: [],
  };
}

describe("値の並びの語彙", () => {
  it("メニューは8種で、向きは ID に含まれる", () => {
    expect(GROUP_SORT_OPTIONS.map((option) => option.id)).toEqual([
      "count-desc",
      "count-asc",
      "name-asc",
      "name-desc",
      "duration-desc",
      "duration-asc",
      "added-desc",
      "last-played",
    ]);
    expect(groupSortColumn("name-desc")).toBe("name");
    expect(groupSortDirection("name-desc")).toBe("desc");
    expect(groupSortDirection("count-asc")).toBe("asc");
  });

  it("最近追加・最近再生は列を持たない", () => {
    expect(groupSortColumn("added-desc")).toBeNull();
    expect(groupSortColumn("last-played")).toBeNull();
    expect(isNameSort("added-desc")).toBe(false);
  });
});

describe("toggleGroupSortColumn（list 列見出しクリック）", () => {
  it("同じ列を再クリックすると昇順降順が反転する", () => {
    expect(toggleGroupSortColumn("count-desc", "count")).toBe("count-asc");
    expect(toggleGroupSortColumn("count-asc", "count")).toBe("count-desc");
  });

  it("別の列（最近追加・最近再生からを含む）は既定の向きで選ぶ（nameは昇順、count/durationは降順）", () => {
    expect(toggleGroupSortColumn("count-asc", "name")).toBe("name-asc");
    expect(toggleGroupSortColumn("name-asc", "duration")).toBe("duration-desc");
    expect(toggleGroupSortColumn("last-played", "count")).toBe("count-desc");
    expect(toggleGroupSortColumn("added-desc", "name")).toBe("name-asc");
  });
});

describe("buildGroupValueDisplayRows", () => {
  it("サーバーが並べた順をそのまま見せる（入れ子の値が無ければ名前順でも並べ替えない）", () => {
    const rows = buildGroupValueDisplayRows([item("う"), item("あ"), item("い")], "", "name-asc");
    expect(rows.map((row) => row.label)).toEqual(["う", "あ", "い"]);
  });

  it("平らな値と入れ子の値が混ざっても、サーバーの順（読み順）が保たれ、降順でも親子が崩れない", () => {
    // 読みのバイト順と localeCompare("ja") で順が変わる値（一・亜）を含む
    const asc = buildGroupValueDisplayRows(
      [item("一"), item("亜"), item("cv/a"), item("cv/b")],
      "",
      "name-asc",
    );
    expect(asc.map((row) => `${row.depth}:${row.label}`)).toEqual([
      "0:一",
      "0:亜",
      "0:cv",
      "1:a",
      "1:b",
    ]);

    const desc = buildGroupValueDisplayRows(
      [item("cv/b"), item("cv/a"), item("亜"), item("一")],
      "",
      "name-desc",
    );
    expect(desc.map((row) => `${row.depth}:${row.label}`)).toEqual([
      "0:cv",
      "1:b",
      "1:a",
      "0:亜",
      "0:一",
    ]);
  });

  it("入れ子の値は名前順のときだけ階層にする", () => {
    const items = [item("cv/a"), item("cv/b")];
    expect(buildGroupValueDisplayRows(items, "", "name-asc").map((row) => row.kind)).toEqual([
      "heading",
      "value",
      "value",
    ]);
    expect(buildGroupValueDisplayRows(items, "", "count-desc").map((row) => row.label)).toEqual([
      "cv/a",
      "cv/b",
    ]);
  });
});
