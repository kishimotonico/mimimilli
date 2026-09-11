// 「要対応」の一元定義。通知ベルと要対応タブが同じ入力から同じ件数を出すことを検証する。
import { describe, expect, it } from "vitest";
import {
  buildNeedsAttentionRows,
  countNeedsAttention,
  type NeedsAttentionSource,
} from "../../src/features/scan/model/needsAttention";

const empty: NeedsAttentionSource = {
  identityConflicts: [],
  invalidMetaFiles: [],
  rjCodeMissingCount: 0,
  dlsiteFetchFailedCount: 0,
  dlsiteParseErrorCount: 0,
  dlsiteParseErrorAlert: false,
  dataIntegrityWarning: undefined,
};

describe("buildNeedsAttentionRows / countNeedsAttention", () => {
  it("何も無ければ空配列・0件", () => {
    expect(buildNeedsAttentionRows(empty)).toEqual([]);
    expect(countNeedsAttention([])).toBe(0);
  });

  it("ID重複はパス数に関わらずworkId単位で1件と数える", () => {
    const rows = buildNeedsAttentionRows({
      ...empty,
      identityConflicts: [{ kind: "identity_conflict", workId: "RJ1", paths: ["a", "b", "c"] }],
    });
    expect(rows).toHaveLength(1);
    expect(countNeedsAttention(rows)).toBe(1);
  });

  it("RJコード未検出・DLsite取得失敗は影響件数をそのまま加算する", () => {
    const rows = buildNeedsAttentionRows({
      ...empty,
      rjCodeMissingCount: 3,
      dlsiteFetchFailedCount: 2,
    });
    expect(countNeedsAttention(rows)).toBe(5);
  });

  it("DLsiteパース失敗はalertが立っているときだけ行を作る", () => {
    const withoutAlert = buildNeedsAttentionRows({
      ...empty,
      dlsiteParseErrorCount: 4,
      dlsiteParseErrorAlert: false,
    });
    expect(withoutAlert).toHaveLength(0);

    const withAlert = buildNeedsAttentionRows({
      ...empty,
      dlsiteParseErrorCount: 4,
      dlsiteParseErrorAlert: true,
    });
    expect(countNeedsAttention(withAlert)).toBe(4);
  });

  it("データ不整合は skippedCount に関わらず1件", () => {
    const rows = buildNeedsAttentionRows({
      ...empty,
      dataIntegrityWarning: { skippedCount: 7, skippedWorkIds: ["a", "b"] },
    });
    expect(countNeedsAttention(rows)).toBe(1);
  });
});
