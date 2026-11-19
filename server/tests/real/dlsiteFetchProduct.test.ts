import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { dlsiteFetchStateOfResolution } from "@mimimilli/shared";
import { DlsiteJobManager } from "../../src/dlsiteJobManager.ts";
import { normalizeDlsiteCoverUrl } from "../../src/adapters/real/dlsite.ts";
import { DlsiteCache } from "../../src/adapters/real/dlsiteCache.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../../src/adapters/real/dlsiteConfig.ts";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import {
  htmlResponse,
  jpegResponse,
  mockDlsiteTransport,
  sampleWorkHtml,
  type MockDlsiteTransportOptions,
} from "../helpers/dlsiteTransport.ts";
import { makeSampleLibrary, makeTestDirectory } from "../helpers/sampleLibrary.ts";
import { configureRoot } from "../helpers/rootFolder.ts";
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FAST_CONFIG = {
  ...DEFAULT_DLSITE_REQUEST_CONFIG,
  requestIntervalMs: 0,
  retryCount: 0,
  maxBackoffMs: 0,
  timeoutMs: 1_000,
};

function coverUrlOf(code: string): string {
  return normalizeDlsiteCoverUrl(
    `https://img.dlsite.jp/modpub/images2/work/doujin/RJ900000/${code}_img_main.jpg`,
  );
}

function setup(t: TestContext, transport: MockDlsiteTransportOptions, config = FAST_CONFIG) {
  const dir = makeTestDirectory("dlsite-fetch-product");
  t.after(dir.cleanup);
  const cachePath = join(dir.path, "cache.sqlite");
  const adapter = dir.own(
    createRealAdapter({
      database: { kind: "memory" },
      dlsiteRequestConfig: config,
      dlsiteCache: { path: cachePath },
      dlsiteSchedulerDependencies: mockDlsiteTransport(transport),
    }),
  );
  const cache = new DlsiteCache({ path: cachePath });
  t.after(() => cache.close());
  return { adapter, cache, dir };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("ジョブの終端状態は、同じコードのDlsiteCache.resolve由来の状態と一致する", async (t) => {
  const { adapter, cache } = setup(t, {
    html: (code) => {
      if (code === "RJ000002") return htmlResponse("gone", 404);
      if (code === "RJ000003") return htmlResponse("error", 500);
      if (code === "RJ000004") return htmlResponse("<html></html>");
      return htmlResponse(sampleWorkHtml(code, { cover: false }));
    },
  });
  const manager = new DlsiteJobManager(adapter);
  const codes = ["RJ000001", "RJ000002", "RJ000003", "RJ000004"];
  manager.start({ origin: "bulk", productCodes: codes });
  while (manager.getSnapshot()?.status !== "finished") await tick();
  const states = Object.fromEntries(
    manager.getSnapshot()!.codes.map((code) => [code.productCode, code.state]),
  );
  assert.deepEqual(states, {
    RJ000001: "fetched",
    RJ000002: "not_found",
    RJ000003: "failed",
    RJ000004: "failed",
  });
  for (const code of codes) {
    assert.equal(
      dlsiteFetchStateOfResolution(cache.resolve({ productCode: code })),
      states[code],
      code,
    );
  }
});

test("forceは失敗の記録を無視して取り直し、forceなしは記録を返す", async (t) => {
  let gone = true;
  let htmlCalls = 0;
  const { adapter, cache } = setup(t, {
    html: (code) => {
      htmlCalls += 1;
      return gone
        ? htmlResponse("gone", 404)
        : htmlResponse(sampleWorkHtml(code, { cover: false }));
    },
  });
  assert.equal(await adapter.fetchDlsiteProduct("RJ000001", { force: false }), "not_found");
  gone = false;
  assert.equal(await adapter.fetchDlsiteProduct("RJ000001", { force: false }), "not_found");
  assert.equal(htmlCalls, 1);
  assert.equal(await adapter.fetchDlsiteProduct("RJ000001", { force: true }), "fetched");
  assert.equal(htmlCalls, 2);
  assert.equal(dlsiteFetchStateOfResolution(cache.resolve({ productCode: "RJ000001" })), "fetched");
});

test("取得は取得ジョブ・fetch-by-code・作品の取得の3経路で、カバーをキャッシュへ先取りする", async (t) => {
  const coverBody = new Uint8Array(
    readFileSync(join(makeSampleLibrary().root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
  );
  const coverCalls: string[] = [];
  const { adapter, cache } = setup(t, {
    html: (code) => htmlResponse(sampleWorkHtml(code, { cover: true })),
    cover: (url) => {
      coverCalls.push(url);
      return jpegResponse(coverBody);
    },
  });
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  await configureRoot(adapter, lib.root);
  await adapter.scan();

  assert.equal(await adapter.fetchDlsiteProduct("RJ000001", { force: false }), "fetched");
  assert.ok(cache.getCover(coverUrlOf("RJ000001")));

  const byCode = await adapter.dlsiteFetchByCode("RJ000002");
  assert.equal(byCode.ok, true);
  assert.ok(cache.getCover(coverUrlOf("RJ000002")));

  const byWork = await adapter.dlsiteFetch(lib.existingWorkId);
  assert.equal(byWork.ok, true);
  assert.ok(cache.getCover(coverUrlOf("RJ900002")));

  assert.equal(coverCalls.length, 3);
  await adapter.fetchDlsiteProduct("RJ000001", { force: false });
  assert.equal(coverCalls.length, 3);
});

test("カバーの取得に失敗しても取得結果は成功のままで、同期経路もそのまま成功を返す", async (t) => {
  const { adapter, cache } = setup(t, {
    html: (code) => htmlResponse(sampleWorkHtml(code, { cover: true })),
    cover: () => Promise.reject(new Error("カバー取得失敗")),
  });
  assert.equal(await adapter.fetchDlsiteProduct("RJ000001", { force: false }), "fetched");
  assert.equal(cache.getCover(coverUrlOf("RJ000001")), null);
  assert.equal((await adapter.dlsiteFetchByCode("RJ000002")).ok, true);
});

test("同期の取得はカバーが期限内に取れなくてもカバーなしで成功を返し、呼び出し元のabortは再送出する", async (t) => {
  const { adapter } = setup(
    t,
    {
      html: (code) => htmlResponse(sampleWorkHtml(code, { cover: true })),
      cover: (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    },
    { ...FAST_CONFIG, timeoutMs: 150 },
  );
  const startedAt = Date.now();
  const result = await adapter.dlsiteFetchByCode("RJ000001");
  assert.equal(result.ok, true);
  assert.ok(Date.now() - startedAt < 1_000);

  const controller = new AbortController();
  const pending = adapter.fetchDlsiteProduct("RJ000002", {
    force: false,
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 30);
  await assert.rejects(pending);
});

test("取得は同じRJコードを持つ全作品の投影を更新する（3経路とも）", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  let gone = true;
  const { adapter } = setup(t, {
    html: (code) =>
      gone ? htmlResponse("gone", 404) : htmlResponse(sampleWorkHtml(code, { cover: false })),
  });
  const duplicateDir = join(lib.root, "dlsite", "RJ900002_複製");
  cpSync(join(lib.root, "dlsite", "RJ900002_既存メタ"), duplicateDir, { recursive: true });
  const duplicateMetaPath = join(duplicateDir, "mimimilli.json");
  const duplicateMeta = JSON.parse(readFileSync(duplicateMetaPath, "utf-8")) as { id: string };
  duplicateMeta.id = "22222222-2222-4222-8222-222222222222";
  writeFileSync(duplicateMetaPath, JSON.stringify(duplicateMeta, null, 2));
  await configureRoot(adapter, lib.root);
  await adapter.scan();
  const duplicateId = "22222222-2222-4222-8222-222222222222";
  const statusOf = async (id: string) => (await adapter.getWork(id))?.dlsite.status;

  await adapter.fetchDlsiteProduct("RJ900002", { force: false });
  assert.equal(await statusOf(lib.existingWorkId), "not_found");
  assert.equal(await statusOf(duplicateId), "not_found");

  gone = false;
  await adapter.dlsiteFetchByCode("RJ900002", true);
  assert.equal(await statusOf(lib.existingWorkId), "none");
  assert.equal(await statusOf(duplicateId), "none");

  gone = true;
  await adapter.dlsiteFetch(lib.existingWorkId, true);
  assert.equal(await statusOf(lib.existingWorkId), "not_found");
  assert.equal(await statusOf(duplicateId), "not_found");
});

test("同じRJコードにmissingや壊れた作品が混ざっても、取得は成功し他の作品の投影は更新される", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const { adapter } = setup(t, { html: () => htmlResponse("gone", 404) });
  const copyDir = join(lib.root, "dlsite", "RJ900002_複製");
  cpSync(join(lib.root, "dlsite", "RJ900002_既存メタ"), copyDir, { recursive: true });
  const copyMetaPath = join(copyDir, "mimimilli.json");
  const copyMeta = JSON.parse(readFileSync(copyMetaPath, "utf-8")) as { id: string };
  const brokenId = "22222222-2222-4222-8222-222222222222";
  copyMeta.id = brokenId;
  writeFileSync(copyMetaPath, JSON.stringify(copyMeta, null, 2));
  await configureRoot(adapter, lib.root);
  await adapter.scan();
  writeFileSync(copyMetaPath, "{ broken");

  assert.equal(await adapter.fetchDlsiteProduct("RJ900002", { force: false }), "not_found");
  assert.equal((await adapter.getWork(lib.existingWorkId))?.dlsite.status, "not_found");
  assert.equal((await adapter.dlsiteFetchByCode("RJ900002", true)).ok, false);

  rmSync(join(lib.root, "dlsite", "RJ900002_既存メタ"), { recursive: true });
  await adapter.scan();
  assert.equal(await adapter.fetchDlsiteProduct("RJ900002", { force: true }), "not_found");
});

test("オフライン設定ではisDlsiteOfflineがtrueを返す", (t) => {
  const { adapter } = setup(t, {}, { ...FAST_CONFIG, offline: true });
  assert.equal(adapter.isDlsiteOffline(), true);
});
