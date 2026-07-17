// DLsiteタイトル適用ポリシー（TASK-42）の純粋関数テスト。
// mode="existing" の一括取得で、フォルダー名またはRJコードのままのタイトルを
// 「初期値のまま」と判定し、DLsiteタイトルで上書きしてよいことを確認する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDefaultTitle } from "../src/core/dlsiteTitle.ts";

test("フォルダー名と完全一致するタイトルは初期値のままと判定する", () => {
  assert.equal(isDefaultTitle("RJ01620477", "/lib/RJ01620477", "RJ01620477"), true);
});

test("フォルダー名と大文字小文字違いで一致するタイトルは初期値のままと判定する", () => {
  assert.equal(isDefaultTitle("rj01620477", "/lib/RJ01620477", "RJ01620477"), true);
});

test("RJコードと一致するがフォルダー名とは異なるタイトルは初期値のままと判定する", () => {
  assert.equal(isDefaultTitle("RJ01620477", "/lib/とある作品フォルダー", "RJ01620477"), true);
});

test("RJコードと大文字小文字違いで一致するタイトルは初期値のままと判定する", () => {
  assert.equal(isDefaultTitle("rj01620477", "/lib/とある作品フォルダー", "RJ01620477"), true);
});

test("ユーザーが編集したタイトルは初期値とみなさない", () => {
  assert.equal(isDefaultTitle("素敵な作品タイトル", "/lib/RJ01620477", "RJ01620477"), false);
});

test("RJコード未検出でもフォルダー名と一致すれば初期値のままと判定する", () => {
  assert.equal(isDefaultTitle("とある作品フォルダー", "/lib/とある作品フォルダー", null), true);
});

test("RJコード未検出でフォルダー名とも異なる場合は初期値とみなさない", () => {
  assert.equal(isDefaultTitle("素敵な作品タイトル", "/lib/とある作品フォルダー", null), false);
});
