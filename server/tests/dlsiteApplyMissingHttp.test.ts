import assert from "node:assert/strict";
import { test } from "node:test";
import { dlsiteApplyMissingBodySchema } from "@mimimilli/shared";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createApp } from "../src/app.ts";

const ENDPOINT = "/api/dlsite/apply-missing";
const INVALID_MESSAGE = "workIds は文字列配列で指定してください";

async function postApplyMissing(
  app: ReturnType<typeof createApp>,
  init?: { body?: string; headers?: Record<string, string> },
) {
  return app.request(ENDPOINT, {
    method: "POST",
    headers: init?.headers,
    body: init?.body,
  });
}

test("dlsiteApplyMissingBodySchema: workIds 省略は全件適用契約", () => {
  assert.deepEqual(dlsiteApplyMissingBodySchema.parse({}), {});
  assert.deepEqual(dlsiteApplyMissingBodySchema.parse({ workIds: ["RJ501001"] }), {
    workIds: ["RJ501001"],
  });
  assert.equal(dlsiteApplyMissingBodySchema.safeParse({ workIds: 1 }).success, false);
});

test("POST /api/dlsite/apply-missing: 空 body と {} は全件適用", async () => {
  for (const body of [undefined, "{}"] as const) {
    const adapter = createFixtureAdapter();
    let received: string[] | undefined = ["not-called"];
    adapter.dlsiteApplyMissing = async (workIds) => {
      received = workIds;
      return { applied: 0, pending: 0, skipped: 0, failed: 0 };
    };
    const res = await postApplyMissing(createApp(adapter), { body });
    assert.equal(res.status, 200, body ?? "empty");
    assert.equal(received, undefined, body ?? "empty");
  }
});

test("POST /api/dlsite/apply-missing: workIds 指定時はその配列を渡す", async () => {
  const adapter = createFixtureAdapter();
  let received: string[] | undefined;
  adapter.dlsiteApplyMissing = async (workIds) => {
    received = workIds;
    return { applied: 1, pending: 0, skipped: 0, failed: 0 };
  };
  const res = await postApplyMissing(createApp(adapter), {
    body: JSON.stringify({ workIds: ["RJ501001"] }),
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(received, ["RJ501001"]);
  const payload = await res.json();
  assert.equal(payload.applied, 1);
});

test("POST /api/dlsite/apply-missing: 不正 JSON・null・型不正 workIds は 400 で適用しない", async () => {
  const cases: { label: string; body?: string }[] = [
    { label: "broken json", body: "{" },
    { label: "json null", body: "null" },
    { label: "workIds number", body: JSON.stringify({ workIds: 1 }) },
    { label: "workIds string", body: JSON.stringify({ workIds: "RJ501001" }) },
    { label: "workIds mixed array", body: JSON.stringify({ workIds: ["RJ501001", 2] }) },
  ];

  for (const { label, body } of cases) {
    const adapter = createFixtureAdapter();
    let called = false;
    adapter.dlsiteApplyMissing = async () => {
      called = true;
      return { applied: 0, pending: 0, skipped: 0, failed: 0 };
    };
    const res = await postApplyMissing(createApp(adapter), {
      body,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    });
    assert.equal(res.status, 400, label);
    assert.equal(called, false, label);
    const payload = await res.json();
    assert.equal(payload.error.code, "invalid_request", label);
    assert.equal(payload.error.message, INVALID_MESSAGE, label);
  }
});
