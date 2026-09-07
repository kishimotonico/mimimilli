import assert from "node:assert/strict";
import { test } from "node:test";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createApp } from "../src/app.ts";
import { nts } from "./helpers/tag.ts";

const ENDPOINT = "/api/dlsite/apply-missing/preview";

async function postPreview(
  app: ReturnType<typeof createApp>,
  init?: { body?: string; headers?: Record<string, string> },
) {
  return app.request(ENDPOINT, {
    method: "POST",
    headers: init?.headers,
    body: init?.body,
  });
}

test("POST /api/dlsite/apply-missing/preview: adapterの結果をそのまま返す（書き込みはしない）", async () => {
  const adapter = createFixtureAdapter();
  let received: string[] | undefined = ["not-called"];
  adapter.dlsiteApplyMissingPreview = async (workIds) => {
    received = workIds;
    return {
      items: [
        {
          workId: "RJ501001",
          title: "テスト作品",
          newTags: nts(["cv/新CV"]),
          applyCover: false,
          applyUrl: true,
        },
      ],
    };
  };
  const res = await postPreview(createApp(adapter), {
    body: JSON.stringify({ workIds: ["RJ501001"] }),
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(received, ["RJ501001"]);
  const payload = await res.json();
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].workId, "RJ501001");
});

test("POST /api/dlsite/apply-missing/preview: 不正なworkIdsは400", async () => {
  const adapter = createFixtureAdapter();
  const res = await postPreview(createApp(adapter), {
    body: JSON.stringify({ workIds: "RJ501001" }),
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(res.status, 400);
});
