import { describe, expect, it } from "vitest";
import {
  MAX_TILE_SIZE,
  MIN_TILE_SIZE,
  clampTileSize,
  selectCoverThumbnailWidth,
} from "../../src/features/library/model/gridSizing";

describe("library grid sizing", () => {
  it("clamps and rounds the persisted tile size", () => {
    expect(clampTileSize(99)).toBe(MIN_TILE_SIZE);
    expect(clampTileSize(176.6)).toBe(177);
    expect(clampTileSize(281)).toBe(MAX_TILE_SIZE);
  });

  it("selects the closest allowed thumbnail width for the rendered density", () => {
    expect(selectCoverThumbnailWidth(100, 1)).toBe(128);
    expect(selectCoverThumbnailWidth(160, 1)).toBe(128);
    expect(selectCoverThumbnailWidth(192, 1)).toBe(256);
    expect(selectCoverThumbnailWidth(176, 2)).toBe(256);
    expect(selectCoverThumbnailWidth(280, 2)).toBe(512);
  });

  it("treats a device pixel ratio below one as one", () => {
    expect(selectCoverThumbnailWidth(280, 0.5)).toBe(256);
  });
});
