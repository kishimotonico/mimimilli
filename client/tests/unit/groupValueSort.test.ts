import { describe, expect, it } from "vitest";
import type { GroupValueItem } from "@mimimilli/shared";
import {
  DEFAULT_GROUP_VALUE_SORT,
  selectGroupValueSortKey,
  sortGroupValueItems,
  toggleGroupValueSort,
} from "../../src/features/library/model/groupValueSort";

function item(value: string, count: number, durationSec: number): GroupValueItem {
  return { value, count, durationSec, covers: [] };
}

describe("sortGroupValueItems", () => {
  it("count 降順（既定）で並べる", () => {
    const items = [item("b", 1, 0), item("a", 3, 0), item("c", 2, 0)];
    const sorted = sortGroupValueItems(items, DEFAULT_GROUP_VALUE_SORT);
    expect(sorted.map((i) => i.value)).toEqual(["a", "c", "b"]);
  });

  it("name 昇順は既定実装で表示名（value）の単純比較になる", () => {
    const items = [item("う", 1, 0), item("あ", 1, 0), item("い", 1, 0)];
    const sorted = sortGroupValueItems(items, { key: "name", direction: "asc" });
    expect(sorted.map((i) => i.value)).toEqual(["あ", "い", "う"]);
  });

  it("duration 降順で並べる", () => {
    const items = [item("a", 1, 10), item("b", 1, 30), item("c", 1, 20)];
    const sorted = sortGroupValueItems(items, { key: "duration", direction: "desc" });
    expect(sorted.map((i) => i.value)).toEqual(["b", "c", "a"]);
  });

  it("count 昇順で並べる（direction反転）", () => {
    const items = [item("b", 3, 0), item("a", 1, 0), item("c", 2, 0)];
    const sorted = sortGroupValueItems(items, { key: "count", direction: "asc" });
    expect(sorted.map((i) => i.value)).toEqual(["a", "c", "b"]);
  });
});

describe("toggleGroupValueSort（list 列見出しクリック）", () => {
  it("同じ列を再クリックすると昇順降順が反転する", () => {
    const first = toggleGroupValueSort({ key: "count", direction: "desc" }, "count");
    expect(first).toEqual({ key: "count", direction: "asc" });
    const second = toggleGroupValueSort(first, "count");
    expect(second).toEqual({ key: "count", direction: "desc" });
  });

  it("別の列をクリックすると既定の向きへ切り替わる（nameは昇順、count/durationは降順）", () => {
    expect(toggleGroupValueSort({ key: "count", direction: "asc" }, "name")).toEqual({
      key: "name",
      direction: "asc",
    });
    expect(toggleGroupValueSort({ key: "name", direction: "asc" }, "duration")).toEqual({
      key: "duration",
      direction: "desc",
    });
  });
});

describe("selectGroupValueSortKey（ソートメニュー選択）", () => {
  it("別のキーを選ぶと既定の向きへ切り替わる", () => {
    expect(selectGroupValueSortKey({ key: "count", direction: "desc" }, "name")).toEqual({
      key: "name",
      direction: "asc",
    });
  });

  it("同じキーを選んでも向きは変わらない（メニューはトグルしない）", () => {
    const current = { key: "count", direction: "asc" } as const;
    expect(selectGroupValueSortKey(current, "count")).toEqual(current);
  });
});
