import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateParseErrorAlert } from "@mimimilli/shared";

test("evaluateParseErrorAlert: 件数・割合の両方を満たすときだけ true", () => {
  assert.equal(evaluateParseErrorAlert(0, 0), false);
  assert.equal(evaluateParseErrorAlert(1, 0), false);
  assert.equal(evaluateParseErrorAlert(2, 1), false);
  assert.equal(evaluateParseErrorAlert(3, 13), false);
  assert.equal(evaluateParseErrorAlert(3, 12), true);
  assert.equal(evaluateParseErrorAlert(3, 0), true);
  assert.equal(evaluateParseErrorAlert(3, 9), true);
  assert.equal(evaluateParseErrorAlert(4, 1), true);
});

test("evaluateParseErrorAlert: not_found は分母に入れない（httpErrorCount のみ）", () => {
  assert.equal(evaluateParseErrorAlert(3, 7), true);
  assert.equal(evaluateParseErrorAlert(2, 10), false);
});
