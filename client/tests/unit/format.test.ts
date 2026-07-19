import { describe, expect, it } from "vitest";
import { formatDuration, formatFileSize, formatTime } from "../../src/shared/lib/format";

describe("formatTime", () => {
  it.each([
    [0, "0:00"],
    [45, "0:45"],
    [125, "2:05"],
    [3661, "1:01:01"],
    [Number.NaN, "0:00"],
    [Number.POSITIVE_INFINITY, "0:00"],
  ])("%s秒を%sにする", (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected);
  });

  it("formatDurationも同じ時刻表現を使う", () => {
    expect(formatDuration(90)).toBe("1:30");
  });
});

describe("formatFileSize", () => {
  it.each([
    [500, "500 B"],
    [1536, "1.5 KB"],
    [2 * 1024 * 1024, "2.0 MB"],
  ])("%s byteを%sにする", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});
