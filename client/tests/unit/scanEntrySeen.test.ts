import { describe, expect, it } from "vitest";
import {
  hasUnseen,
  nextSeen,
  parseScanEntrySeen,
  type ScanEntrySeen,
} from "../../src/features/scan/model/scanEntrySeen";

const seen: ScanEntrySeen = {
  candidates: ["a", "b"],
  needsAttention: ["identity:1"],
  changes: ["2026-01-01T00:00:00.000Z"],
};

describe("hasUnseen", () => {
  it("記憶に無いキーが読めている集合にあれば true", () => {
    expect(hasUnseen({ candidates: ["a", "c"], needsAttention: null, changes: null }, seen)).toBe(
      true,
    );
    expect(
      hasUnseen({ candidates: null, needsAttention: ["identity:2"], changes: null }, seen),
    ).toBe(true);
  });

  it("消えたキーだけなら false", () => {
    expect(hasUnseen({ candidates: ["a"], needsAttention: [], changes: null }, seen)).toBe(false);
  });

  it("読めていない集合は判定に入れない", () => {
    expect(
      hasUnseen(
        { candidates: null, needsAttention: null, changes: null },
        { candidates: [], needsAttention: [], changes: [] },
      ),
    ).toBe(false);
  });
});

describe("変化のあったスキャン", () => {
  it("記憶に無い完了時刻が来たら未読、見たあとは同じ時刻では未読にならない", () => {
    const current = {
      candidates: null,
      needsAttention: null,
      changes: ["2026-02-01T00:00:00.000Z"],
    };
    expect(hasUnseen(current, seen)).toBe(true);
    expect(hasUnseen(current, nextSeen(seen, current))).toBe(false);
  });
});

describe("nextSeen", () => {
  it("読めている集合だけ現在のキーで置き換える（和集合にしない）", () => {
    expect(nextSeen(seen, { candidates: ["c", "a"], needsAttention: null, changes: null })).toEqual(
      {
        candidates: ["a", "c"],
        needsAttention: ["identity:1"],
        changes: ["2026-01-01T00:00:00.000Z"],
      },
    );
  });

  it("内容が同じなら同じ参照を返す", () => {
    expect(
      nextSeen(seen, {
        candidates: ["b", "a"],
        needsAttention: ["identity:1"],
        changes: ["2026-01-01T00:00:00.000Z"],
      }),
    ).toBe(seen);
    expect(nextSeen(seen, { candidates: null, needsAttention: null, changes: null })).toBe(seen);
  });
});

describe("parseScanEntrySeen", () => {
  it("正しい形はそのまま通す", () => {
    expect(parseScanEntrySeen(seen)).toEqual(seen);
  });

  it("壊れた値・別形の値は空として扱う", () => {
    const empty = { candidates: [], needsAttention: [], changes: [] };
    expect(parseScanEntrySeen(null)).toEqual(empty);
    expect(parseScanEntrySeen("x")).toEqual(empty);
    expect(parseScanEntrySeen({ candidates: "a", needsAttention: [] })).toEqual(empty);
    expect(parseScanEntrySeen({ candidates: [1], needsAttention: [] })).toEqual(empty);
    expect(parseScanEntrySeen({ candidates: [] })).toEqual(empty);
  });
});
