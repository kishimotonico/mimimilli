import assert from "node:assert/strict";
import { test } from "node:test";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import type { DataAdapter } from "../src/adapter.ts";
import { createApp } from "../src/app.ts";
import { captureLogs, categoryRecords, recordMessage } from "./helpers/logCapture.ts";

function withStubAdapter(overrides: Partial<DataAdapter>): DataAdapter {
  return { ...createFixtureAdapter(), ...overrides };
}

function httpRequestRecords(records: ReturnType<typeof categoryRecords>) {
  return records.filter((record) => recordMessage(record) === "HTTPリクエストを処理しました");
}

test("2xx リクエストは http カテゴリの DEBUG で requestId 等を記録する", async () => {
  await captureLogs(
    async (records) => {
      const app = createApp(createFixtureAdapter());
      const res = await app.request("/api/works");
      assert.equal(res.status, 200);

      const logged = httpRequestRecords(categoryRecords(records, "http"));
      assert.equal(logged.length, 1);
      assert.equal(logged[0]!.level, "debug");
      const properties = logged[0]!.properties;
      assert.ok(typeof properties.requestId === "string" && properties.requestId.length > 0);
      assert.equal(properties.method, "GET");
      assert.equal(properties.path, "/api/works");
      assert.equal(properties.status, 200);
      assert.equal(typeof properties.durationMs, "number");
    },
    { categories: ["http"] },
  );
});

test("404 リクエストは http カテゴリの WARN で記録する", async () => {
  await captureLogs(
    async (records) => {
      const app = createApp(createFixtureAdapter());
      const res = await app.request("/api/unknown-route");
      assert.equal(res.status, 404);

      const logged = httpRequestRecords(categoryRecords(records, "http"));
      assert.equal(logged.length, 1);
      assert.equal(logged[0]!.level, "warning");
      assert.equal(logged[0]!.properties.status, 404);
      assert.ok(logged[0]!.properties.requestId);
    },
    { categories: ["http"] },
  );
});

test("HTTPException(4xx) は http カテゴリの WARN で記録する", async () => {
  await captureLogs(
    async (records) => {
      const app = createApp(createFixtureAdapter());
      const res = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootFolder: 123 }),
      });
      assert.equal(res.status, 400);

      const requestLogged = httpRequestRecords(categoryRecords(records, "http"));
      assert.equal(requestLogged.length, 1);
      assert.equal(requestLogged[0]!.level, "warning");
      assert.equal(requestLogged[0]!.properties.status, 400);

      const exceptionLogged = categoryRecords(records, "http").filter(
        (record) => recordMessage(record) === "HTTP例外が発生しました",
      );
      assert.equal(exceptionLogged.length, 1);
      assert.equal(exceptionLogged[0]!.level, "warning");
      assert.equal(exceptionLogged[0]!.properties.status, 400);
      assert.equal(exceptionLogged[0]!.properties.path, "/api/settings");
      assert.ok(exceptionLogged[0]!.properties.requestId);
    },
    { categories: ["http"] },
  );
});

test("内部エラー(5xx) は http カテゴリの ERROR で記録する", async () => {
  await captureLogs(
    async (records) => {
      const adapter = withStubAdapter({
        getSettings: async () => {
          throw new Error("fixture internal failure");
        },
      });
      const app = createApp(adapter);
      const res = await app.request("/api/settings");
      assert.equal(res.status, 500);

      const requestLogged = httpRequestRecords(categoryRecords(records, "http"));
      assert.equal(requestLogged.length, 1);
      assert.equal(requestLogged[0]!.level, "error");
      assert.equal(requestLogged[0]!.properties.status, 500);

      const errorLogged = categoryRecords(records, "http").filter(
        (record) => recordMessage(record) === "リクエスト処理中にエラーが発生しました",
      );
      assert.equal(errorLogged.length, 1);
      assert.equal(errorLogged[0]!.level, "error");
      assert.equal(errorLogged[0]!.properties.message, "fixture internal failure");
      assert.ok(errorLogged[0]!.properties.requestId);
    },
    { categories: ["http"] },
  );
});
