import { describe, expect, it } from "vitest";
import {
  formatScanProgressLabel,
  scanPhaseLabel,
} from "../../src/entities/scan/model/scanProgressLabel";

describe("scanProgressLabel", () => {
  it("フェーズごとに表示文言を返す", () => {
    expect(scanPhaseLabel("reading")).toBe("作品情報を読み込み中");
    expect(scanPhaseLabel("registering")).toBe("作品を登録中");
  });

  it("件数ありは processed/total を添え、total=0 は件数不定として省略記号にする", () => {
    expect(formatScanProgressLabel({ phase: "reading", processed: 3, total: 12 })).toBe(
      "作品情報を読み込み中 (3/12)",
    );
    expect(formatScanProgressLabel({ phase: "walking", processed: 50, total: 0 })).toBe(
      "フォルダーを走査中...",
    );
    expect(formatScanProgressLabel(null)).toBeNull();
  });
});
