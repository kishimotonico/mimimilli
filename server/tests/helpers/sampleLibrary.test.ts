import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { makeTestDirectory, makeTestScope } from "./sampleLibrary.ts";

test("makeTestScope cleanup は登録逆順で close する", async () => {
  const scope = makeTestScope();
  const order: string[] = [];
  scope.ownFn({ label: "first" }, () => {
    order.push("first");
  });
  scope.ownFn({ label: "second" }, () => {
    order.push("second");
  });
  await scope.cleanup();
  assert.deepEqual(order, ["second", "first"]);
});

test("makeTestDirectory cleanup は owned resource を閉じてからディレクトリを削除する", async () => {
  const directory = makeTestDirectory("scope-cleanup");
  const path = directory.path;
  let closed = false;
  directory.ownFn({ label: "db" }, () => {
    closed = true;
  });
  await directory.cleanup();
  assert.equal(closed, true);
  assert.equal(existsSync(path), false);
});

test("makeTestScope cleanup は1つが失敗しても残りの closer を実行する", async () => {
  const scope = makeTestScope();
  const order: string[] = [];
  scope.ownFn({ label: "first" }, () => {
    order.push("first");
  });
  scope.ownFn({ label: "fail" }, () => {
    throw new Error("fail-middle");
  });
  scope.ownFn({ label: "third" }, () => {
    order.push("third");
  });
  await assert.rejects(() => scope.cleanup(), /fail-middle/);
  assert.deepEqual(order, ["third", "first"]);
});

test("makeTestDirectory cleanup は closer が失敗してもディレクトリを削除する", async () => {
  const directory = makeTestDirectory("scope-cleanup-fail");
  const path = directory.path;
  directory.ownFn({ label: "fail" }, () => {
    throw new Error("fail-close");
  });
  await assert.rejects(() => directory.cleanup(), /fail-close/);
  assert.equal(existsSync(path), false);
});

test("makeTestScope cleanup は最初の例外を投げ、以降を suppressed に積む", async () => {
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
  await assert.rejects(
    () => scope.cleanup(),
    (error: unknown) => {
      assert.equal(error, third);
      assert.deepEqual((error as { suppressed?: unknown[] }).suppressed, [second, first]);
      return true;
    },
  );
});

test("makeTestScope cleanup は全 closer が成功すれば例外を投げない", async () => {
  const scope = makeTestScope();
  scope.ownFn({ label: "only" }, () => {});
  await assert.doesNotReject(() => scope.cleanup());
});

test("makeTestDirectory cleanup は Promise を返す close の完了を待ってからディレクトリを削除する", async () => {
  const directory = makeTestDirectory("scope-cleanup-async");
  const path = directory.path;
  let closed = false;
  directory.ownFn({ label: "adapter" }, async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(existsSync(path), true);
    closed = true;
  });
  await directory.cleanup();
  assert.equal(closed, true);
  assert.equal(existsSync(path), false);
});
