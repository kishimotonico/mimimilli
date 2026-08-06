import { describe, expect, it } from "vitest";
import { formatDlsiteBulkResult } from "../../src/features/dlsite/model/formatDlsiteBulkResult";

describe("formatDlsiteBulkResult", () => {
  it("dataIntegrityWarning があるとき不整合除外件数を含める", () => {
    expect(
      formatDlsiteBulkResult({
        fetched: 3,
        failed: 1,
        parseErrors: 0,
        skipped: 2,
        dataIntegrityWarning: { skippedCount: 1, skippedWorkIds: ["work-bad"] },
      }),
    ).toBe("取得 3件・失敗 1件・不整合除外 1件");
  });

  it("dataIntegrityWarning が無いとき従来どおりの件数のみ", () => {
    expect(
      formatDlsiteBulkResult({
        fetched: 2,
        failed: 0,
        parseErrors: 1,
        skipped: 0,
      }),
    ).toBe("取得 2件・失敗 0件（うちパース 1件）");
  });
});
