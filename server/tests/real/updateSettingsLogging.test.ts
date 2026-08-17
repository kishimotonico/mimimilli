import assert from "node:assert/strict";
import { mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { NotConfiguredError } from "../../src/errors.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { captureLogs, categoryRecords, recordMessage } from "../helpers/logCapture.ts";
import { makeTestDirectory, makeTestScope } from "../helpers/sampleLibrary.ts";

test("存在しないパスを updateSettings に渡すと server カテゴリの WARN を記録する", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const adapter = scope.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await captureLogs(
    async (records) => {
      await assert.rejects(
        () => adapter.updateSettings({ rootFolder: "/path/does/not/exist/for-mimimilli" }),
        (error: unknown) => {
          assert.ok(error instanceof NotConfiguredError);
          return true;
        },
      );

      const logged = categoryRecords(records, "server").filter(
        (record) => recordMessage(record) === "ルートフォルダーの解決に失敗しました",
      );
      assert.equal(logged.length, 1);
      assert.equal(logged[0]!.level, "warning");
      assert.equal(logged[0]!.properties.requestedPath, "/path/does/not/exist/for-mimimilli");
      assert.equal(logged[0]!.properties.code, "ENOENT");
      assert.equal(typeof logged[0]!.properties.message, "string");
    },
    { categories: ["server"] },
  );
});

test("updateSettings 成功時に requestedPath と resolvedPath を INFO で記録する", async (t) => {
  const directory = makeTestDirectory("settings-logging-root");
  t.after(directory.cleanup);
  const rootDir = join(directory.path, "root");
  mkdirSync(rootDir, { recursive: true });
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const requestedPath = rootDir;
  const resolvedPath = realpathSync(rootDir);
  await captureLogs(
    async (records) => {
      await adapter.updateSettings({ rootFolder: requestedPath });

      const logged = categoryRecords(records, "server").filter(
        (record) => recordMessage(record) === "ルートフォルダーを解決しました",
      );
      assert.equal(logged.length, 1);
      assert.equal(logged[0]!.level, "info");
      assert.equal(logged[0]!.properties.requestedPath, requestedPath);
      assert.equal(logged[0]!.properties.resolvedPath, resolvedPath);
    },
    { categories: ["server"] },
  );
});
