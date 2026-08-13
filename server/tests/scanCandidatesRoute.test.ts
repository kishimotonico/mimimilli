import assert from "node:assert/strict";
import { test } from "node:test";
import {
  scanCandidateSchema,
  scanCandidatesRegisterResponseSchema,
  type DlsiteBulkResult,
} from "@mimimilli/shared";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createApp } from "../src/app.ts";

const candidate = scanCandidateSchema.parse({
  path: "候補作品",
  inferredTitle: "候補作品",
  audioFileCount: 2,
  audioBreakdown: [{ extension: "wav", count: 2 }],
});

test("候補APIは取得・一括登録・stale拒否を提供し、登録ごとにDLsite取得をenqueueする", async () => {
  const queued: string[][] = [];
  const adapter = createFixtureAdapter();
  const app = createApp({
    ...adapter,
    listScanCandidates: async () => [candidate],
    registerScanCandidates: async (_paths, onRegistered) => {
      onRegistered?.("work-a");
      onRegistered?.("work-b");
      return scanCandidatesRegisterResponseSchema.parse({
        registered: [
          { path: "候補作品", workId: "work-a" },
          { path: "候補作品-2", workId: "work-b" },
        ],
        failures: [],
      });
    },
    excludeScanCandidates: async () => {
      throw new Error("候補が更新されています。再スキャンして選び直してください");
    },
    runDlsiteBulk: async (_mode, workIds): Promise<DlsiteBulkResult> => {
      queued.push(workIds ?? []);
      return { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 };
    },
  });

  try {
    const listed = await app.request("/api/scan/candidates");
    assert.equal(listed.status, 200);
    assert.deepEqual((await listed.json()).candidates, [candidate]);

    const registered = await app.request("/api/scan/candidates/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: ["候補作品"] }),
    });
    assert.equal(registered.status, 201);
    assert.deepEqual(await registered.json(), {
      registered: [
        { path: "候補作品", workId: "work-a" },
        { path: "候補作品-2", workId: "work-b" },
      ],
      failures: [],
    });
    for (let attempt = 0; attempt < 20 && queued.length < 2; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.deepEqual(queued, [["work-a"], ["work-b"]]);

    const stale = await app.request("/api/scan/candidates/exclude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: ["候補作品"] }),
    });
    assert.equal(stale.status, 409);
  } finally {
    await app.shutdown();
  }
});

test("候補登録APIは部分失敗と全失敗を201で返し、成功分だけenqueueする", async () => {
  const queued: string[][] = [];
  const fixture = createFixtureAdapter();
  const app = createApp({
    ...fixture,
    registerScanCandidates: async (_paths, onRegistered) => {
      onRegistered?.("work-ok");
      return scanCandidatesRegisterResponseSchema.parse({
        registered: [{ path: "候補作品", workId: "work-ok" }],
        failures: [{ path: "失敗作品", message: "catalogの投影に失敗しました" }],
      });
    },
    runDlsiteBulk: async (_mode, workIds): Promise<DlsiteBulkResult> => {
      queued.push(workIds ?? []);
      return { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 };
    },
  });
  try {
    const partial = await app.request("/api/scan/candidates/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: ["候補作品"] }),
    });
    assert.equal(partial.status, 201);
    assert.deepEqual(await partial.json(), {
      registered: [{ path: "候補作品", workId: "work-ok" }],
      failures: [{ path: "失敗作品", message: "catalogの投影に失敗しました" }],
    });
    for (let attempt = 0; attempt < 20 && queued.length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.deepEqual(queued, [["work-ok"]]);
  } finally {
    await app.shutdown();
  }
});

test("候補登録APIは全失敗を成功なしの結果として返し、staleは409で書込み前に拒否する", async () => {
  const fixture = createFixtureAdapter();
  const app = createApp({
    ...fixture,
    registerScanCandidates: async () =>
      scanCandidatesRegisterResponseSchema.parse({
        registered: [],
        failures: [{ path: "候補作品", message: "mimimilli.jsonの生成に失敗しました" }],
      }),
  });
  try {
    const failed = await app.request("/api/scan/candidates/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: ["候補作品"] }),
    });
    assert.equal(failed.status, 201);
    assert.deepEqual(await failed.json(), {
      registered: [],
      failures: [{ path: "候補作品", message: "mimimilli.jsonの生成に失敗しました" }],
    });
  } finally {
    await app.shutdown();
  }

  const staleApp = createApp({
    ...fixture,
    registerScanCandidates: async () => {
      throw new Error("候補が更新されています。再スキャンして選び直してください");
    },
  });
  try {
    const stale = await staleApp.request("/api/scan/candidates/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: ["候補作品"] }),
    });
    assert.equal(stale.status, 409);
  } finally {
    await staleApp.shutdown();
  }
});

test("候補APIは101件以上の一括登録を受け付ける", async () => {
  const paths = Array.from({ length: 101 }, (_, index) => `候補-${index}`);
  const fixture = createFixtureAdapter();
  let received: string[] = [];
  const app = createApp({
    ...fixture,
    registerScanCandidates: async (requestedPaths) => {
      received = requestedPaths;
      return { registered: [], failures: [] };
    },
  });
  try {
    const response = await app.request("/api/scan/candidates/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(received, paths);
  } finally {
    await app.shutdown();
  }
});
