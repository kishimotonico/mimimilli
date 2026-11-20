// POST /api/dlsite/jobs の progress の force が、失敗の記録の取り直しまで届くことを real / fixture 両方に流す。
import assert from "node:assert/strict";
import { test } from "node:test";
import type { DataAdapter } from "../src/adapter/index.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../src/adapters/real/dlsiteConfig.ts";
import { htmlResponse, mockDlsiteTransport, sampleWorkHtml } from "./helpers/dlsiteTransport.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { createApp } from "./helpers/testApp.ts";

/** fixture では取得すると該当なしになるコード（FIXTURE_DLSITE_NOT_FOUND_RJ_CODE） */
const CODE = "RJ000403";

interface Subject {
  name: string;
  create(): { adapter: DataAdapter; recover(): void };
}

const subjects: Subject[] = [
  {
    name: "fixture",
    create: () => ({ adapter: createFixtureAdapter(), recover: () => {} }),
  },
  {
    name: "real",
    create: () => {
      let gone = true;
      const adapter = createTestRealAdapter({
        database: { kind: "memory" },
        dlsiteRequestConfig: {
          ...DEFAULT_DLSITE_REQUEST_CONFIG,
          requestIntervalMs: 0,
          retryCount: 0,
          maxBackoffMs: 0,
          timeoutMs: 1_000,
        },
        dlsiteSchedulerDependencies: mockDlsiteTransport({
          html: (code) =>
            gone ? htmlResponse("gone", 404) : htmlResponse(sampleWorkHtml(code, { cover: false })),
        }),
      });
      return { adapter, recover: () => (gone = false) };
    },
  },
];

async function runJob(
  app: ReturnType<typeof createApp>,
  body: Record<string, unknown>,
): Promise<string> {
  const start = await app.request("/api/dlsite/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productCodes: [CODE], ...body }),
  });
  assert.equal(start.status, 202);
  for (let attempt = 0; attempt < 200; attempt++) {
    const current = await (await app.request("/api/dlsite/jobs/current")).json();
    const entry = current.job?.codes.find(
      (code: { productCode: string }) => code.productCode === CODE,
    );
    if (current.job?.status === "finished" && entry) return entry.state;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("取得ジョブが終わりませんでした");
}

for (const subject of subjects) {
  test(`POST /api/dlsite/jobs（${subject.name}）: progressはforceなしだと失敗の記録を返し、force=trueだと取り直す`, async (t) => {
    const { adapter, recover } = subject.create();
    t.after(() => adapter.close?.());
    const forces: boolean[] = [];
    const original = adapter.fetchDlsiteProduct.bind(adapter);
    adapter.fetchDlsiteProduct = (code, options) => {
      forces.push(options.force);
      return original(code, options);
    };
    const app = createApp(adapter);

    assert.equal(await runJob(app, {}), "not_found");
    recover();
    assert.equal(await runJob(app, { force: false }), "not_found");
    const forced = await runJob(app, { force: true });
    assert.deepEqual(forces, [false, false, true]);
    assert.equal(forced, subject.name === "real" ? "fetched" : "not_found");
  });
}
