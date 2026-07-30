// updateDlsiteState の状態遷移（applyDlsiteStatePatch）の純粋関数テスト。
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDlsiteStatePatch, type DlsiteState } from "@mimimilli/shared";

const appliedState: DlsiteState = {
  rjCode: "RJ1234567",
  status: "applied",
  lastAttemptAt: "2026-06-10T12:00:00.000Z",
  error: null,
  errorKind: null,
  appliedTags: ["genre/耳かき", "cv/水瀬なずな"],
};

test("RJコード変更時は旧コード由来の取得結果をクリアして未取得に戻す", () => {
  const next = applyDlsiteStatePatch(appliedState, { rjCode: "RJ7654321" });
  assert.equal(next.rjCode, "RJ7654321");
  assert.equal(next.status, "none");
  assert.equal(next.lastAttemptAt, null);
  assert.equal(next.error, null);
  assert.equal(next.errorKind, null);
  assert.deepEqual(next.appliedTags, []);
});

test("同じRJコードの再保存では状態を維持する", () => {
  const next = applyDlsiteStatePatch(appliedState, { rjCode: "RJ1234567" });
  assert.deepEqual(next, appliedState);
});

test("skipped切替は従来どおり status と error/errorKind を上書きする", () => {
  const withError: DlsiteState = {
    ...appliedState,
    status: "error",
    error: "前回失敗",
    errorKind: "offline",
  };
  const skipped = applyDlsiteStatePatch(withError, { skipped: true });
  assert.equal(skipped.status, "skipped");
  assert.equal(skipped.error, null);
  assert.equal(skipped.errorKind, null);
  assert.deepEqual(skipped.appliedTags, withError.appliedTags);

  const enabled = applyDlsiteStatePatch(skipped, { skipped: false });
  assert.equal(enabled.status, "none");
  assert.equal(enabled.error, null);
  assert.equal(enabled.errorKind, null);
});

test("RJコード変更とskipped指定が同時のとき skipped が優先される", () => {
  const next = applyDlsiteStatePatch(appliedState, { rjCode: "RJ7654321", skipped: true });
  assert.equal(next.rjCode, "RJ7654321");
  assert.equal(next.status, "skipped");
  assert.deepEqual(next.appliedTags, []);
});
