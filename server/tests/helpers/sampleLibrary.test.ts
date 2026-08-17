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

test("makeTestScope cleanup は1つが失敗しても残りの closer を実行する", () => {
  const scope = makeTestScope();
  const order: string[] = [];
  scope.ownFn({ label: "first" }, () => order.push("first"));
  scope.ownFn({ label: "fail" }, () => {
    throw new Error("fail-middle");
  });
  scope.ownFn({ label: "third" }, () => order.push("third"));
  assert.throws(() => scope.cleanup(), /fail-middle/);
  assert.deepEqual(order, ["third", "first"]);
});

test("makeTestDirectory cleanup は closer が失敗してもディレクトリを削除する", () => {
  const directory = makeTestDirectory("scope-cleanup-fail");
  const path = directory.path;
  directory.ownFn({ label: "fail" }, () => {
    throw new Error("fail-close");
  });
  assert.throws(() => directory.cleanup(), /fail-close/);
  assert.equal(existsSync(path), false);
});

test("makeTestScope cleanup は最初の例外を投げ、以降を suppressed に積む", () => {
  const scope = makeTestScope();
  const first = new Error("first-fail");
  const second = new Error("second-fail");
  const third = new Error("third-fail");
  scope.ownFn({}, () => {
    throw first;
  });
  scope.ownFn({}, () => {
    throw second;
  });
  scope.ownFn({}, () => {
    throw third;
  });
  assert.throws(
    () => scope.cleanup(),
    (error: unknown) => {
      assert.equal(error, third);
      assert.deepEqual((error as { suppressed?: unknown[] }).suppressed, [second, first]);
      return true;
    },
  );
});

test("makeTestScope cleanup は全 closer が成功すれば例外を投げない", () => {
  const scope = makeTestScope();
  scope.ownFn({ label: "only" }, () => {});
  assert.doesNotThrow(() => scope.cleanup());
});
