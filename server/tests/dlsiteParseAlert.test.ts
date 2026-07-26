import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateParseErrorAlert } from "@mimimilli/shared";

test("evaluateParseErrorAlert: 件数・割合の両方を満たすときだけ true", () => {
  assert.equal(evaluateParseErrorAlert(0, 0), false);
  assert.equal(evaluateParseErrorAlert(1, 0), false);
  assert.equal(evaluateParseErrorAlert(2, 10), false);
  assert.equal(evaluateParseErrorAlert(3, 13), false);
  assert.equal(evaluateParseErrorAlert(3, 12), true);
  assert.equal(evaluateParseErrorAlert(3, 0), true);
  assert.equal(evaluateParseErrorAlert(3, 9), true);
  assert.equal(evaluateParseErrorAlert(4, 1), true);
});

test("evaluateParseErrorAlert: 大量成功・少数パース失敗ではアラートしない", () => {
  assert.equal(evaluateParseErrorAlert(3, 997), false);
  assert.equal(evaluateParseErrorAlert(3, 994), false);
  assert.equal(evaluateParseErrorAlert(3, 12), true);
});

test("evaluateParseErrorAlert: HTTPエラーは分母に含めない", () => {
  // パース失敗3・成功12 → 20% でアラート。HTTP失敗が多くても変わらない想定は呼び出し側の責務
  assert.equal(evaluateParseErrorAlert(3, 12), true);
  assert.equal(evaluateParseErrorAlert(2, 10), false);
});
