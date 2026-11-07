// workspacePath / relativeToRoot: 正規化結果の維持、末尾スラッシュ除去の線形性、スキーマの長さ上限。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WORKSPACE_PATH_MAX_LENGTH,
  relativeToRoot,
  workspacePath,
  workspacePathSchema,
} from "@mimimilli/shared";

test("バックスラッシュを / に直し、末尾の / を除去する", () => {
  assert.equal(workspacePath("a\\b\\c"), "a/b/c");
  assert.equal(workspacePath("a/b///"), "a/b");
  assert.equal(workspacePath("a\\b\\\\"), "a/b");
  assert.equal(workspacePath("a//b"), "a//b");
  assert.equal(workspacePath(""), "");
});

test("絶対パスと . .. の段を拒否する", () => {
  for (const value of ["/a", "\\a", "C:a", "c:\\a", "a/./b", "a/../b", "a/..", "a\\..\\b", "./"]) {
    assert.throws(() => workspacePath(value), Error, value);
  }
  assert.equal(workspacePath("a/..b/c."), "a/..b/c.");
});

test("末尾一致しない長いスラッシュ列を線形時間で処理する", () => {
  const input = `a${"/".repeat(200_000)}a`;
  const startedAt = performance.now();
  assert.equal(workspacePath(input), input);
  assert.ok(performance.now() - startedAt < 1000);
});

test("末尾が全てスラッシュの長い入力も除去できる", () => {
  assert.equal(workspacePath(`a${"/".repeat(200_000)}`), "a");
});

test("スキーマは長さ上限ちょうどを通し、超過を変換前に拒否する", () => {
  assert.equal(workspacePathSchema.safeParse("a".repeat(WORKSPACE_PATH_MAX_LENGTH)).success, true);
  const over = workspacePathSchema.safeParse("a".repeat(WORKSPACE_PATH_MAX_LENGTH + 1));
  assert.equal(over.success, false);
  assert.equal(over.error?.issues[0]?.code, "too_big");
});

test("Windowsの長いパス相当の相対パスを通す", () => {
  const deep = Array.from({ length: 40 }, () => "d".repeat(100)).join("\\");
  assert.equal(workspacePathSchema.safeParse(deep).success, true);
});

test("relativeToRoot: Windows区切りと末尾スラッシュ付きrootを相対パスにする", () => {
  assert.equal(relativeToRoot("C:\\lib\\RJ1\\a.wav", "C:\\lib\\"), "RJ1/a.wav");
  assert.equal(relativeToRoot("/lib/RJ1/", "/lib//"), "RJ1");
  assert.equal(relativeToRoot("/lib", "/lib"), "");
});

test("relativeToRoot: 末尾一致しない長いスラッシュ列を線形時間で処理する", () => {
  const input = `a${"/".repeat(200_000)}a`;
  const startedAt = performance.now();
  assert.equal(relativeToRoot(input, "/lib"), input);
  assert.equal(relativeToRoot(`a${"/".repeat(200_000)}`, `/lib${"/".repeat(200_000)}`), "a");
  assert.ok(performance.now() - startedAt < 1000);
});
