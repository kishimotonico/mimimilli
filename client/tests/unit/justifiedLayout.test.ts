import { describe, expect, it } from "vitest";
import { computeJustifiedLayout } from "../../src/features/library/model/justifiedLayout";

describe("justified grid layout", () => {
  it("returns nothing for an empty item list or an unmeasured container", () => {
    expect(
      computeJustifiedLayout([], { containerWidth: 800, targetRowHeight: 176, gap: 14 }),
    ).toEqual({
      tiles: [],
      rowHeights: [],
    });
    expect(
      computeJustifiedLayout([{ id: "a", aspectRatio: 1 }], {
        containerWidth: 0,
        targetRowHeight: 176,
        gap: 14,
      }),
    ).toEqual({ tiles: [], rowHeights: [] });
  });

  it("stretches a full row so its tiles exactly fill the container width", () => {
    // 1:1 が4枚、目標高さ100pxなら4*100+3*gap=414 (gap=14) で、
    // containerWidth=400なら1枚追加する前に既に埋まる想定でテストを組み立てる
    const items = [
      { id: "a", aspectRatio: 1 },
      { id: "b", aspectRatio: 1 },
      { id: "c", aspectRatio: 1 },
    ];
    const layout = computeJustifiedLayout(items, {
      containerWidth: 300,
      targetRowHeight: 100,
      gap: 10,
    });

    expect(layout.rowHeights).toHaveLength(1);
    const totalWidth =
      layout.tiles.reduce((sum, tile) => sum + tile.width, 0) + 10 * (layout.tiles.length - 1);
    expect(totalWidth).toBeCloseTo(300, 5);
    // 正方形なので全タイルの幅は等しい
    expect(layout.tiles[0].width).toBeCloseTo(layout.tiles[1].width, 5);
  });

  it("keeps the trailing incomplete row at the target height, left-aligned (not stretched)", () => {
    // 目標高さのままだと行幅を満たせない1枚だけの最終行
    const items = [{ id: "solo", aspectRatio: 1 }];
    const layout = computeJustifiedLayout(items, {
      containerWidth: 1000,
      targetRowHeight: 176,
      gap: 14,
    });

    expect(layout.rowHeights).toEqual([176]);
    expect(layout.tiles[0].width).toBeCloseTo(176, 5);
  });

  it("packs items into multiple rows and assigns increasing rowIndex", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ id: `w${i}`, aspectRatio: 1.33 }));
    const layout = computeJustifiedLayout(items, {
      containerWidth: 600,
      targetRowHeight: 150,
      gap: 10,
    });

    expect(layout.tiles).toHaveLength(8);
    const rowIndexes = layout.tiles.map((t) => t.rowIndex);
    // 単調非減少（行を跨ぐたびに1ずつ増える）
    for (let i = 1; i < rowIndexes.length; i++) {
      expect(rowIndexes[i]).toBeGreaterThanOrEqual(rowIndexes[i - 1]);
    }
    expect(layout.rowHeights.length).toBeGreaterThan(1);
  });

  it("clamps extreme aspect ratios so a single outlier image cannot break a row", () => {
    const items = [
      { id: "wide", aspectRatio: 20 }, // 極端な横長 → クランプされる
      { id: "b", aspectRatio: 1 },
    ];
    const layout = computeJustifiedLayout(items, {
      containerWidth: 500,
      targetRowHeight: 100,
      gap: 10,
    });

    // クランプ上限(3)を超えた幅にはならない
    const wideTile = layout.tiles.find((t) => t.id === "wide");
    expect(wideTile).toBeDefined();
    if (wideTile) {
      expect(wideTile.width / layout.rowHeights[wideTile.rowIndex]).toBeLessThanOrEqual(3 + 1e-6);
    }
  });

  it("treats non-finite or non-positive aspect ratios as square (1:1)", () => {
    const items = [
      { id: "a", aspectRatio: Number.NaN },
      { id: "b", aspectRatio: 0 },
      { id: "c", aspectRatio: -2 },
    ];
    const layout = computeJustifiedLayout(items, {
      containerWidth: 1000,
      targetRowHeight: 100,
      gap: 10,
    });

    // 目標高さのままでは埋まらない最終行として、全て正方形(width===targetRowHeight)になる
    for (const tile of layout.tiles) {
      expect(tile.width).toBeCloseTo(100, 5);
    }
  });

  it("computes centerX as the running midpoint of each tile within its row", () => {
    const items = [
      { id: "a", aspectRatio: 1 },
      { id: "b", aspectRatio: 1 },
    ];
    const layout = computeJustifiedLayout(items, {
      containerWidth: 1000,
      targetRowHeight: 100,
      gap: 10,
    });

    // 最終行・未充足なので伸縮なし: 幅100固定、gap10
    const [a, b] = layout.tiles;
    expect(a.centerX).toBeCloseTo(50, 5);
    expect(b.centerX).toBeCloseTo(100 + 10 + 50, 5);
  });
});
