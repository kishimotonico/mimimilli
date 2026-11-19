import { describe, expect, it } from "vitest";
import {
  hasUnseen,
  nextSeen,
  parseScanEntrySeen,
  type ScanEntrySeen,
} from "../../src/features/scan/model/scanEntrySeen";

const seen: ScanEntrySeen = { candidates: ["a", "b"], needsAttention: ["identity:1"] };

describe("hasUnseen", () => {
  it("記憶に無いキーが読めている集合にあれば true", () => {
    expect(hasUnseen({ candidates: ["a", "c"], needsAttention: null }, seen)).toBe(true);
    expect(hasUnseen({ candidates: null, needsAttention: ["identity:2"] }, seen)).toBe(true);
  });

  it("消えたキーだけなら false", () => {
    expect(hasUnseen({ candidates: ["a"], needsAttention: [] }, seen)).toBe(false);
  });

  it("読めていない集合は判定に入れない", () => {
    expect(
      hasUnseen({ candidates: null, needsAttention: null }, { candidates: [], needsAttention: [] }),
    ).toBe(false);
  });
});

describe("nextSeen", () => {
  it("読めている集合だけ現在のキーで置き換える（和集合にしない）", () => {
    expect(nextSeen(seen, { candidates: ["c", "a"], needsAttention: null })).toEqual({
      candidates: ["a", "c"],
      needsAttention: ["identity:1"],
    });
  });

  it("内容が同じなら同じ参照を返す", () => {
    expect(nextSeen(seen, { candidates: ["b", "a"], needsAttention: ["identity:1"] })).toBe(seen);
    expect(nextSeen(seen, { candidates: null, needsAttention: null })).toBe(seen);
  });
});

describe("parseScanEntrySeen", () => {
  it("正しい形はそのまま通す", () => {
    expect(parseScanEntrySeen(seen)).toEqual(seen);
  });

  it("壊れた値・別形の値は空として扱う", () => {
    const empty = { candidates: [], needsAttention: [] };
    expect(parseScanEntrySeen(null)).toEqual(empty);
    expect(parseScanEntrySeen("x")).toEqual(empty);
    expect(parseScanEntrySeen({ candidates: "a", needsAttention: [] })).toEqual(empty);
    expect(parseScanEntrySeen({ candidates: [1], needsAttention: [] })).toEqual(empty);
    expect(parseScanEntrySeen({ candidates: [] })).toEqual(empty);
  });
});
