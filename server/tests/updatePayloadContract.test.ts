// 更新系 API の空 payload 拒否。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./helpers/testApp.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";

function buildApp() {
  return createApp(createFixtureAdapter());
}

async function assertEmptyPayloadRejected(
  request: (app: ReturnType<typeof buildApp>) => Response | Promise<Response>,
): Promise<void> {
  const res = await request(buildApp());
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "invalid_request");
}

test("PATCH /api/works/:id は空オブジェクトを400で拒否する", async () => {
  const app = buildApp();
  const works = await (await app.request("/api/smart-folders/all/works?sort=added-desc")).json();
  const id = works.items[0].id;

  await assertEmptyPayloadRejected((app) =>
    app.request(`/api/works/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
});

test("PATCH /api/tag-prefixes/:prefix は空オブジェクトを400で拒否する", async () => {
  await assertEmptyPayloadRejected((app) =>
    app.request(`/api/tag-prefixes/${encodeURIComponent("cv")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
});

test("PATCH /api/smart-folders/:id は空オブジェクトを400で拒否する", async () => {
  await assertEmptyPayloadRejected((app) =>
    app.request("/api/smart-folders/fav", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
});
