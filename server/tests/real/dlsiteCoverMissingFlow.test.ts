// パーサー v1 のキャッシュから、候補のカバー未取得・取得失敗・取り直し・追加でのカバー適用までの経路。
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { scanCandidateSchema, type ScanCandidate } from "@mimimilli/shared";
import { DLSITE_PARSER, DLSITE_PARSER_VERSION } from "../../src/adapters/real/dlsite.ts";
import type { DlsiteParser } from "../../src/adapters/real/dlsite.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../../src/adapters/real/dlsiteConfig.ts";
import {
  htmlResponse,
  jpegResponse,
  mockDlsiteTransport,
  sampleWorkHtml,
} from "../helpers/dlsiteTransport.ts";
import { pollUntil } from "../helpers/poll.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { configureRoot } from "../helpers/rootFolder.ts";
import {
  SAMPLE_COVER_JPEG_BASE64,
  makeTestDirectory,
  makeTestScope,
  writeWav,
} from "../helpers/sampleLibrary.ts";
import { runScan } from "../helpers/scanLibrary.ts";
import { createApp } from "../helpers/testApp.ts";

const CODE = "RJ000001";
const FOLDER = `${CODE}_未登録作品`;
const SAMPLE_COVER = new Uint8Array(Buffer.from(SAMPLE_COVER_JPEG_BASE64, "base64"));

const legacyParser: DlsiteParser = {
  version: DLSITE_PARSER_VERSION - 1,
  parse(html, rjCode) {
    const result = DLSITE_PARSER.parse(html, rjCode);
    return result.ok ? { ok: true, info: { ...result.info, coverUrl: null } } : result;
  },
};

test("v1のキャッシュ（coverUrl=null）は、v2で読み直すとカバー未取得になり、取得に失敗すると再起動後も失敗のまま取得されず、取り直すと追加でカバーが付く", async (t) => {
  const directory = makeTestDirectory("dlsite-cover-missing-flow");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  mkdirSync(join(root, FOLDER), { recursive: true });
  writeWav(join(root, FOLDER, "track.wav"), 1);
  const cachePath = join(directory.path, "dlsite-cache.sqlite");
  const requests = { html: 0, cover: 0 };
  let coverAvailable = true;

  const stage = (context: TestContext) => {
    const scope = makeTestScope();
    let ended = false;
    const end = async () => {
      if (ended) return;
      ended = true;
      await scope.cleanup();
    };
    context.after(end);
    return { scope, end };
  };
  const open = async (scope: ReturnType<typeof makeTestScope>, parser: DlsiteParser) => {
    const adapter = scope.own(
      createTestRealAdapter({
        database: { kind: "memory" },
        dlsiteCache: { path: cachePath },
        dlsiteParser: parser,
        dlsiteRequestConfig: {
          ...DEFAULT_DLSITE_REQUEST_CONFIG,
          requestIntervalMs: 0,
          retryCount: 0,
          maxBackoffMs: 0,
          timeoutMs: 1_000,
        },
        dlsiteSchedulerDependencies: mockDlsiteTransport({
          html: (code) => {
            requests.html += 1;
            return htmlResponse(sampleWorkHtml(code, { title: `タイトル${code}` }));
          },
          cover: () => {
            requests.cover += 1;
            return coverAvailable ? jpegResponse(SAMPLE_COVER) : htmlResponse("", 404);
          },
        }),
      }),
    );
    const app = scope.ownFn(createApp(adapter), (a) => a.shutdown());
    await configureRoot(adapter, root);
    await runScan(adapter);
    return app;
  };
  const candidate = async (app: ReturnType<typeof createApp>): Promise<ScanCandidate> => {
    const response = await app.request("/api/scan/candidates");
    const { candidates } = (await response.json()) as { candidates: unknown[] };
    const found = candidates
      .map((entry) => scanCandidateSchema.parse(entry))
      .find((entry) => entry.path === FOLDER);
    assert.ok(found);
    return found;
  };
  const fetchJob = async (app: ReturnType<typeof createApp>, force = false) => {
    const started = await app.request("/api/dlsite/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productCodes: [CODE], force }),
    });
    assert.equal(started.status, 202);
    await pollUntil(async () => {
      const { job } = (await (await app.request("/api/dlsite/jobs/current")).json()) as {
        job: { status: string } | null;
      };
      return job?.status === "finished";
    });
  };

  const legacy = stage(t);
  const legacyApp = await open(legacy.scope, legacyParser);
  await fetchJob(legacyApp);
  assert.deepEqual((await candidate(legacyApp)).dlsite, {
    state: "fetched",
    title: `タイトル${CODE}`,
    cover: { state: "none" },
  });
  await legacy.end();
  assert.deepEqual(requests, { html: 1, cover: 0 });

  coverAvailable = false;
  const failing = stage(t);
  const failingApp = await open(failing.scope, DLSITE_PARSER);
  assert.deepEqual((await candidate(failingApp)).dlsite, {
    state: "fetched",
    title: `タイトル${CODE}`,
    cover: { state: "missing" },
  });
  assert.deepEqual(requests, { html: 1, cover: 0 }, "読み直しは通信しない");

  await fetchJob(failingApp);
  assert.deepEqual(requests, { html: 1, cover: 1 }, "HTMLはキャッシュを使い、画像だけ取る");
  assert.deepEqual((await candidate(failingApp)).dlsite, {
    state: "fetched",
    title: `タイトル${CODE}`,
    cover: { state: "failed" },
  });
  await failing.end();

  const restarted = stage(t);
  const restartedApp = await open(restarted.scope, DLSITE_PARSER);
  const restartedCandidate = await candidate(restartedApp);
  assert.ok(
    restartedCandidate.dlsite.state === "fetched" &&
      restartedCandidate.dlsite.cover.state === "failed",
    "再起動しても失敗の記録は残る",
  );
  await fetchJob(restartedApp);
  assert.deepEqual(requests, { html: 1, cover: 1 }, "失敗の記録が残るあいだは取りに行かない");

  coverAvailable = true;
  await fetchJob(restartedApp, true);
  assert.deepEqual(requests, { html: 1, cover: 2 }, "forceは記録があっても画像を取りに行く");
  const after = await candidate(restartedApp);
  assert.ok(after.dlsite.state === "fetched" && after.dlsite.cover.state === "cached");

  const registered = await restartedApp.request("/api/scan/candidates/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paths: [FOLDER],
      apply: { title: true, cover: true, tags: true, url: true },
    }),
  });
  assert.equal(registered.status, 201);
  const { registered: works } = (await registered.json()) as {
    registered: Array<{ workId: string; coverSkipped: string | null }>;
  };
  assert.equal(works[0]!.coverSkipped, null);
  const work = (await (await restartedApp.request(`/api/works/${works[0]!.workId}`)).json()) as {
    cover: unknown;
  };
  assert.ok(work.cover);
});
