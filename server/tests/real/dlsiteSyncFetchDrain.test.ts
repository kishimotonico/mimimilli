import assert from "node:assert/strict";
import { spyOn } from "bun:test";
import { test, type TestContext } from "node:test";
import { DlsiteCache } from "../../src/adapters/real/dlsiteCache.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../../src/adapters/real/dlsiteConfig.ts";
import {
  htmlResponse,
  jpegResponse,
  mockDlsiteTransport,
  sampleWorkHtml,
} from "../helpers/dlsiteTransport.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { makeSampleLibrary, SAMPLE_COVER_JPEG_BASE64 } from "../helpers/sampleLibrary.ts";
import { configureRoot } from "../helpers/rootFolder.ts";
import { runScan } from "../helpers/scanLibrary.ts";

const FAST_REQUESTS = {
  ...DEFAULT_DLSITE_REQUEST_CONFIG,
  requestIntervalMs: 0,
  retryCount: 0,
  maxBackoffMs: 0,
  timeoutMs: 5_000,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("同期取得は、カバー取得の後ろに積まれた別コードの通信を待たずに返る", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const releaseCover = Promise.withResolvers<void>();
  const releaseOther = Promise.withResolvers<void>();
  const coverRequested = Promise.withResolvers<void>();
  const OTHER_CODE = "RJ900099";
  const adapter = lib.own(
    createTestRealAdapter({
      database: { kind: "memory" },
      dlsiteRequestConfig: FAST_REQUESTS,
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: async (code) => {
          if (code === OTHER_CODE) await releaseOther.promise;
          return htmlResponse(sampleWorkHtml(code, { cover: code !== OTHER_CODE }));
        },
        cover: async () => {
          coverRequested.resolve();
          await releaseCover.promise;
          return jpegResponse(new Uint8Array(Buffer.from(SAMPLE_COVER_JPEG_BASE64, "base64")));
        },
      }),
    }),
  );
  await configureRoot(adapter, lib.root);
  await runScan(adapter);
  const snapshot = await adapter.getWorkEditSnapshot(lib.existingWorkId);
  await adapter.updateDlsiteState(lib.existingWorkId, {
    sourceRevision: snapshot!.sourceRevision,
    rjCode: "RJ900002",
  });

  const synchronous = adapter.dlsiteFetch(lib.existingWorkId, true);
  await coverRequested.promise;
  const background = adapter.fetchDlsiteProduct(OTHER_CODE, { force: false });
  await sleep(30);
  releaseCover.resolve();

  const outcome = await Promise.race([
    synchronous.then((result) => result.ok),
    sleep(1_000).then(() => "waited-for-background" as const),
  ]);
  assert.equal(outcome, true);

  releaseOther.resolve();
  assert.equal(await background, "fetched");
});

async function openAdapterWithPendingCover(
  t: TestContext,
  cover: (init: RequestInit | undefined, released: Promise<void>) => Promise<Response>,
) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const release = Promise.withResolvers<void>();
  const coverRequested = Promise.withResolvers<void>();
  const adapter = createTestRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_REQUESTS,
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: (code) => htmlResponse(sampleWorkHtml(code, { cover: true })),
      cover: (_url, init) => {
        coverRequested.resolve();
        return cover(init, release.promise);
      },
    }),
  });
  await configureRoot(adapter, lib.root);
  await runScan(adapter);
  const snapshot = await adapter.getWorkEditSnapshot(lib.existingWorkId);
  await adapter.updateDlsiteState(lib.existingWorkId, {
    sourceRevision: snapshot!.sourceRevision,
    rjCode: "RJ900002",
  });
  const controller = new AbortController();
  const synchronous = adapter.dlsiteFetch(lib.existingWorkId, true, { signal: controller.signal });
  await coverRequested.promise;
  controller.abort();
  await assert.rejects(synchronous);
  return { adapter, release };
}

const sampleCover = () =>
  jpegResponse(new Uint8Array(Buffer.from(SAMPLE_COVER_JPEG_BASE64, "base64")));

test("closeの後に応答が返った通信は、キャッシュへ書かない", async (t) => {
  const { adapter, release } = await openAdapterWithPendingCover(t, async (_init, released) => {
    await released;
    return sampleCover();
  });
  const putCover = spyOn(DlsiteCache.prototype, "putCover");
  const recordSuccess = spyOn(DlsiteCache.prototype, "recordSuccess");
  const recordFailure = spyOn(DlsiteCache.prototype, "recordFailure");
  t.after(() => {
    putCover.mockRestore();
    recordSuccess.mockRestore();
    recordFailure.mockRestore();
  });

  const closing = adapter.close();
  release.resolve();
  await closing;

  assert.equal(putCover.mock.calls.length, 0);
  assert.equal(recordSuccess.mock.calls.length, 0);
  assert.equal(recordFailure.mock.calls.length, 0);
});

test("中止に応える通信が残っていても、closeはすぐ終わる", async (t) => {
  const { adapter } = await openAdapterWithPendingCover(
    t,
    (init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          {
            once: true,
          },
        );
      }),
  );
  const startedAt = Date.now();
  await adapter.close();
  assert.ok(Date.now() - startedAt < 1_000);
});
