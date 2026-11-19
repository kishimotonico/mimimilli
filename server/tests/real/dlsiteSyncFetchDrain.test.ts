import assert from "node:assert/strict";
import { test } from "node:test";
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
  await adapter.scan();
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

test("要求元が中止して返った後も続くカバー取得を、adapterのcloseが待ってからキャッシュを閉じる", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const releaseCover = Promise.withResolvers<void>();
  const coverRequested = Promise.withResolvers<void>();
  const adapter = createTestRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_REQUESTS,
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: (code) => htmlResponse(sampleWorkHtml(code, { cover: true })),
      cover: async () => {
        coverRequested.resolve();
        await releaseCover.promise;
        return jpegResponse(new Uint8Array(Buffer.from(SAMPLE_COVER_JPEG_BASE64, "base64")));
      },
    }),
  });
  await configureRoot(adapter, lib.root);
  await adapter.scan();
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

  let closed = false;
  const closing = adapter.close().then(() => {
    closed = true;
  });
  await sleep(50);
  assert.equal(closed, false);
  releaseCover.resolve();
  await closing;
  assert.equal(closed, true);
});
