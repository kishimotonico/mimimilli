// fixture アダプタも、作品単位の読み直しでデータ不整合の記録から対象が消える契約を満たす。
import assert from "node:assert/strict";
import { test } from "node:test";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createApp } from "./helpers/testApp.ts";
import { pollUntil } from "./helpers/poll.ts";

test("データ不整合の作品を読み直すと、GET /scan/last の dataIntegrityWarning から消える", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "errors" }));
  const lastWarning = async () =>
    ((await (await app.request("/api/scan/last")).json()) as { dataIntegrityWarning?: unknown })
      .dataIntegrityWarning;
  const scan = async () => {
    const started = await app.request("/api/scan", { method: "POST" });
    const { job } = (await started.json()) as { job: { id: string } };
    await pollUntil(
      async () =>
        ((await (await app.request(`/api/scan/${job.id}`)).json()) as { status: string }).status ===
        "completed",
    );
  };

  await scan();
  assert.deepEqual(await lastWarning(), { skippedCount: 1, skippedWorkIds: ["RJ501099"] });

  const res = await app.request("/api/works/RJ501099/reload", { method: "POST" });
  assert.equal(res.status, 204);
  assert.equal(await lastWarning(), undefined);

  await scan();
  assert.equal(await lastWarning(), undefined);
});

test("存在しない作品の読み直しは404", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "errors" }));
  const res = await app.request("/api/works/no-such-work/reload", { method: "POST" });
  assert.equal(res.status, 404);
});
