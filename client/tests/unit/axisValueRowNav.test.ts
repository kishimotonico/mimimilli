import { describe, expect, it } from "vitest";
import {
  getNextAxisValueRowIndex,
  nearestValueRowIndex,
} from "../../src/features/library/model/axisValueRowNav";
import type { AxisValueHierarchyRow } from "../../src/features/library/model/axisValueHierarchy";

function value(path: string): AxisValueHierarchyRow {
  return { kind: "value", depth: 0, path, label: path, item: { value: path, count: 1 } } as never;
}

function heading(path: string): AxisValueHierarchyRow {
  return { kind: "heading", depth: 0, path, label: path } as never;
}

describe("getNextAxisValueRowIndex", () => {
  it("見出し行を飛ばして値行間を移動する", () => {
    const rows = [heading("h"), value("a"), value("b"), heading("h2"), value("c")];
    expect(getNextAxisValueRowIndex(rows, 1, "ArrowDown")).toBe(2);
    expect(getNextAxisValueRowIndex(rows, 2, "ArrowDown")).toBe(4);
  });

  it("端ではラップアラウンドせずクランプする（作品一覧と同じ規則）", () => {
    const rows = [value("a"), value("b")];
    expect(getNextAxisValueRowIndex(rows, 0, "ArrowUp")).toBe(0);
    expect(getNextAxisValueRowIndex(rows, 1, "ArrowDown")).toBe(1);
  });

  it("Homeは先頭の値行、Endは末尾の値行を返す（見出し行は対象外）", () => {
    const rows = [heading("h"), value("a"), value("b"), heading("h2")];
    expect(getNextAxisValueRowIndex(rows, 1, "Home")).toBe(1);
    expect(getNextAxisValueRowIndex(rows, 1, "End")).toBe(2);
  });

  it("値行が無ければ-1を返す", () => {
    const rows = [heading("h")];
    expect(getNextAxisValueRowIndex(rows, 0, "Home")).toBe(-1);
    expect(getNextAxisValueRowIndex(rows, 0, "End")).toBe(-1);
  });

  it("0件のときは-1を返す", () => {
    expect(getNextAxisValueRowIndex([], 0, "ArrowDown")).toBe(-1);
  });
});

describe("nearestValueRowIndex", () => {
  it("すでに値行ならそのまま返す", () => {
    const rows = [heading("h"), value("a")];
    expect(nearestValueRowIndex(rows, 1)).toBe(1);
  });

  it("見出し行なら前方優先で最も近い値行へ寄せる", () => {
    const rows = [value("a"), heading("h"), value("b")];
    expect(nearestValueRowIndex(rows, 1)).toBe(2);
  });

  it("前方に値行が無ければ後方を探す", () => {
    const rows = [value("a"), heading("h")];
    expect(nearestValueRowIndex(rows, 1)).toBe(0);
  });

  it("値行が無ければ-1を返す", () => {
    expect(nearestValueRowIndex([heading("h")], 0)).toBe(-1);
  });
});
