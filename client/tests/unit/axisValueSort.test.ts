import { describe, expect, it } from "vitest";
import type { AxisFacetItem } from "@mimimilli/shared";
import {
  DEFAULT_AXIS_VALUE_SORT,
  selectAxisValueSortKey,
  sortAxisValueItems,
  toggleAxisValueSort,
} from "../../src/features/library/model/axisValueSort";

function item(value: string, count: number, durationSec: number): AxisFacetItem {
  return { value, count, durationSec, covers: [] };
}

describe("sortAxisValueItems", () => {
  it("count 降順（既定）で並べる", () => {
    const items = [item("b", 1, 0), item("a", 3, 0), item("c", 2, 0)];
    const sorted = sortAxisValueItems(items, DEFAULT_AXIS_VALUE_SORT);
    expect(sorted.map((i) => i.value)).toEqual(["a", "c", "b"]);
  });

  it("name 昇順は既定実装で表示名（value）の単純比較になる", () => {
    const items = [item("う", 1, 0), item("あ", 1, 0), item("い", 1, 0)];
    const sorted = sortAxisValueItems(items, { key: "name", direction: "asc" });
    expect(sorted.map((i) => i.value)).toEqual(["あ", "い", "う"]);
  });

  it("duration 降順で並べる", () => {
    const items = [item("a", 1, 10), item("b", 1, 30), item("c", 1, 20)];
    const sorted = sortAxisValueItems(items, { key: "duration", direction: "desc" });
    expect(sorted.map((i) => i.value)).toEqual(["b", "c", "a"]);
  });

  it("count 昇順で並べる（direction反転）", () => {
    const items = [item("b", 3, 0), item("a", 1, 0), item("c", 2, 0)];
    const sorted = sortAxisValueItems(items, { key: "count", direction: "asc" });
    expect(sorted.map((i) => i.value)).toEqual(["a", "c", "b"]);
  });
});

describe("toggleAxisValueSort（list 列見出しクリック）", () => {
  it("同じ列を再クリックすると昇順降順が反転する", () => {
    const first = toggleAxisValueSort({ key: "count", direction: "desc" }, "count");
    expect(first).toEqual({ key: "count", direction: "asc" });
    const second = toggleAxisValueSort(first, "count");
    expect(second).toEqual({ key: "count", direction: "desc" });
  });

  it("別の列をクリックすると既定の向きへ切り替わる（nameは昇順、count/durationは降順）", () => {
    expect(toggleAxisValueSort({ key: "count", direction: "asc" }, "name")).toEqual({
      key: "name",
      direction: "asc",
    });
    expect(toggleAxisValueSort({ key: "name", direction: "asc" }, "duration")).toEqual({
      key: "duration",
      direction: "desc",
    });
  });
});

describe("selectAxisValueSortKey（ソートメニュー選択）", () => {
  it("別のキーを選ぶと既定の向きへ切り替わる", () => {
    expect(selectAxisValueSortKey({ key: "count", direction: "desc" }, "name")).toEqual({
      key: "name",
      direction: "asc",
    });
  });

  it("同じキーを選んでも向きは変わらない（メニューはトグルしない）", () => {
    const current = { key: "count", direction: "asc" } as const;
    expect(selectAxisValueSortKey(current, "count")).toEqual(current);
  });
});
