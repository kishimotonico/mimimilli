import { describe, expect, it } from "vitest";
import { formatDuration, formatFileSize, formatTime } from "../../src/shared/lib/format";

describe("formatTime", () => {
  it.each([
    [0, "0:00"],
    [45, "0:45"],
    [125, "2:05"],
    [3661, "1:01:01"],
  ])("%s秒を%sにする", (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])("%sはnullを返す", (seconds) => {
    expect(formatTime(seconds)).toBeNull();
  });

  it("formatDurationは総時間表示用に四捨五入する", () => {
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(906.6)).toBe("15:07");
  });

  it("formatDurationも非有限値はnull", () => {
    expect(formatDuration(Number.NaN)).toBeNull();
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
