import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyDlsiteState,
  hasRjCode,
  isDlsiteFetchFailed,
  isDlsiteParseFailed,
  isRjCodeMissing,
  type DlsiteState,
} from "@mimimilli/shared";

function dlsiteState(
  rjCode: DlsiteState["rjCode"],
  status: DlsiteState["status"] = "none",
): DlsiteState {
  return { ...emptyDlsiteState(), rjCode, status };
}

test("hasRjCode: null と空文字はRJコードなし、非空文字列のみtrue", () => {
  assert.equal(hasRjCode(dlsiteState(null)), false);
  assert.equal(hasRjCode(dlsiteState("")), false);
  assert.equal(hasRjCode(dlsiteState("RJ123456")), true);
});

test("isRjCodeMissing: null のみ未検出。空文字はユーザー明示のRJコードなし", () => {
  assert.equal(isRjCodeMissing(dlsiteState(null)), true);
  assert.equal(isRjCodeMissing(dlsiteState("")), false);
  assert.equal(isRjCodeMissing(dlsiteState("RJ123456")), false);
  assert.equal(isRjCodeMissing(dlsiteState(null, "skipped")), false);
});

test("isDlsiteFetchFailed / isDlsiteParseFailed: 状態ごとに取得失敗とパース失敗を排他に判定する", () => {
  const state = (
    status: DlsiteState["status"],
    errorKind: DlsiteState["errorKind"],
  ): DlsiteState => ({ ...emptyDlsiteState(), rjCode: "RJ123456", status, errorKind });
  const cases: Array<[DlsiteState, { fetch: boolean; parse: boolean }]> = [
    [state("none", null), { fetch: false, parse: false }],
    [state("applied", null), { fetch: false, parse: false }],
    [state("skipped", null), { fetch: false, parse: false }],
    [state("not_found", "not_found"), { fetch: true, parse: false }],
    [state("not_found", null), { fetch: true, parse: false }],
    [state("error", null), { fetch: true, parse: false }],
    [state("error", "error"), { fetch: true, parse: false }],
    [state("error", "parse_error"), { fetch: false, parse: true }],
  ];
  for (const [dlsite, expected] of cases) {
    const label = `${dlsite.status}/${dlsite.errorKind}`;
    assert.equal(isDlsiteFetchFailed(dlsite), expected.fetch, `fetch ${label}`);
    assert.equal(isDlsiteParseFailed(dlsite), expected.parse, `parse ${label}`);
  }
});
