import { describe, expect, it } from "vitest";
import { formatDlsiteBulkApplyMissingResult } from "../../src/features/dlsite/model/formatDlsiteBulkApplyMissingResult";

describe("formatDlsiteBulkApplyMissingResult", () => {
  it("適用・スキップ・失敗件数を整形する", () => {
    expect(formatDlsiteBulkApplyMissingResult({ applied: 3, skipped: 5, failed: 1 })).toBe(
      "適用 3件・スキップ 5件・失敗 1件",
    );
  });
});
