import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { makeTestDirectory, makeTestScope } from "./sampleLibrary.ts";

test("makeTestScope cleanup は登録逆順で close する", () => {
  const scope = makeTestScope();
  const order: string[] = [];
  scope.ownFn({ label: "first" }, () => order.push("first"));
  scope.ownFn({ label: "second" }, () => order.push("second"));
  scope.cleanup();
  assert.deepEqual(order, ["second", "first"]);
});

test("makeTestDirectory cleanup は owned resource を閉じてからディレクトリを削除する", () => {
  const directory = makeTestDirectory("scope-cleanup");
  const path = directory.path;
  let closed = false;
  directory.ownFn({ label: "db" }, () => {
    closed = true;
  });
  directory.cleanup();
  assert.equal(closed, true);
  assert.equal(existsSync(path), false);
});
