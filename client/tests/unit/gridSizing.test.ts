import { describe, expect, it } from "vitest";
import {
  MAX_TILE_SIZE,
  MIN_TILE_SIZE,
  clampTileSize,
  computeGridColumnCount,
} from "../../src/shared/lib/gridSizing";

describe("grid sizing", () => {
  it("clamps and rounds the persisted tile size", () => {
    expect(clampTileSize(50)).toBe(MIN_TILE_SIZE);
    expect(clampTileSize(176.6)).toBe(177);
    expect(clampTileSize(500)).toBe(MAX_TILE_SIZE);
  });
});

describe("continuous column count for the 1:1 tile grid", () => {
  it("picks the column count whose rendered width is closest to the target size", () => {
    // N = round((containerWidth + gap) / (target + gap))
    // (800+14)/(176+14) = 4.28 -> 4列。実寸 = (800-3*14)/4 = 189.5px（目標176pxに近い）
    expect(computeGridColumnCount(800, 176, 14)).toBe(4);
  });

  it("never returns fewer than one column, even for a very narrow container", () => {
    expect(computeGridColumnCount(50, 176, 14)).toBe(1);
  });

  it("returns 1 for an unmeasured (zero or negative) container width", () => {
    expect(computeGridColumnCount(0, 176, 14)).toBe(1);
    expect(computeGridColumnCount(-10, 176, 14)).toBe(1);
  });

  it("clamps the target size like the slider itself before computing columns", () => {
    // targetTileSize が範囲外でも clampTileSize 相当の値で計算される
    expect(computeGridColumnCount(800, 9999, 14)).toBe(
      computeGridColumnCount(800, MAX_TILE_SIZE, 14),
    );
    expect(computeGridColumnCount(800, 1, 14)).toBe(computeGridColumnCount(800, MIN_TILE_SIZE, 14));
  });
});
