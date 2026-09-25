// updateDlsiteState の状態遷移（applyDlsiteStatePatch）の純粋関数テスト。
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDlsiteStatePatch, type MetaDlsiteState } from "@mimimilli/shared";
import { nts } from "./helpers/tag.ts";

const appliedState: MetaDlsiteState = {
  rjCode: "RJ1234567",
  status: "applied",
  appliedTags: nts(["genre/耳かき", "cv/水瀬なずな"]),
};

test("RJコード変更時は旧コード由来の適用済みタグをクリアして未取得に戻す", () => {
  const next = applyDlsiteStatePatch(appliedState, { rjCode: "RJ7654321" });
  assert.equal(next.rjCode, "RJ7654321");
  assert.equal(next.status, "none");
  assert.deepEqual(next.appliedTags, []);
});

test("同じRJコードの再保存では状態を維持する", () => {
  const next = applyDlsiteStatePatch(appliedState, { rjCode: "RJ1234567" });
  assert.deepEqual(next, appliedState);
});

test("skipped切替は従来どおり status を上書きする", () => {
  const skipped = applyDlsiteStatePatch(appliedState, { skipped: true });
  assert.equal(skipped.status, "skipped");
  assert.deepEqual(skipped.appliedTags, appliedState.appliedTags);

  const enabled = applyDlsiteStatePatch(skipped, { skipped: false });
  assert.equal(enabled.status, "none");
});

test("RJコード変更とskipped指定が同時のとき skipped が優先される", () => {
  const next = applyDlsiteStatePatch(appliedState, { rjCode: "RJ7654321", skipped: true });
  assert.equal(next.rjCode, "RJ7654321");
  assert.equal(next.status, "skipped");
  assert.deepEqual(next.appliedTags, []);
});
