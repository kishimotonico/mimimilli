import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDataPaths } from "../src/adapters/real/dataRoot.ts";
import { buildStartupLogProperties } from "../src/lib/startupLog.ts";

test("real adapter の起動ログ properties にデータパスと logFile を載せる", () => {
  const dataPaths = resolveDataPaths(
    { MIMIMILLI_DATA_DIR: "/tmp/mimimilli-startup-real" },
    "linux",
    "/home/test",
  );
  const logFilePath = `${dataPaths.logDir}/server-2026-08-08.jsonl`;

  const properties = buildStartupLogProperties({
    adapterKind: "real",
    dataPaths,
    logFilePath,
    scenario: undefined,
  });

  assert.equal(properties.adapter, "real");
  assert.equal(properties.dataRoot, dataPaths.root);
  assert.equal(properties.catalogDb, dataPaths.catalogDb);
  assert.equal(properties.userDb, dataPaths.userDb);
  assert.equal(properties.logFile, logFilePath);
  assert.equal("scenario" in properties, false);
});

test("fixture adapter の起動ログ properties に DB パスや logFile を載せない", () => {
  const withoutScenario = buildStartupLogProperties({
    adapterKind: "fixture",
    dataPaths: undefined,
    logFilePath: null,
    scenario: undefined,
  });
  assert.deepEqual(withoutScenario, { adapter: "fixture" });

  const withScenario = buildStartupLogProperties({
    adapterKind: "fixture",
    dataPaths: undefined,
    logFilePath: null,
    scenario: "new-work",
  });
  assert.deepEqual(withScenario, { adapter: "fixture", scenario: "new-work" });
  assert.equal("dataRoot" in withScenario, false);
  assert.equal("catalogDb" in withScenario, false);
  assert.equal("userDb" in withScenario, false);
  assert.equal("logFile" in withScenario, false);
});
