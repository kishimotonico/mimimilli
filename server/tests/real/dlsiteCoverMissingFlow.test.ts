// パーサー v1 のキャッシュから、候補のカバー未取得・取得・追加でのカバー適用までの経路。
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
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
import { SAMPLE_COVER_JPEG_BASE64, makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";
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

test("v1のキャッシュ（coverUrl=null）は、v2で読み直すとcover_missingになり、取得で画像がキャッシュされ、追加でカバーが付く", async (t) => {
  const directory = makeTestDirectory("dlsite-cover-missing-flow");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  mkdirSync(join(root, FOLDER), { recursive: true });
  writeWav(join(root, FOLDER, "track.wav"), 1);
  const cachePath = join(directory.path, "dlsite-cache.sqlite");
  const requests = { html: 0, cover: 0 };

  const open = async (parser: DlsiteParser) => {
    const adapter = directory.own(
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
            return jpegResponse(SAMPLE_COVER);
          },
        }),
      }),
    );
    const app = createApp(adapter);
    await configureRoot(adapter, root);
    await runScan(adapter);
    return { adapter, app };
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
  const fetchJob = async (app: ReturnType<typeof createApp>) => {
    const started = await app.request("/api/dlsite/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productCodes: [CODE] }),
    });
    assert.equal(started.status, 202);
    await pollUntil(async () => {
      const { job } = (await (await app.request("/api/dlsite/jobs/current")).json()) as {
        job: { status: string } | null;
      };
      return job?.status === "finished";
    });
  };

  const legacy = await open(legacyParser);
  await fetchJob(legacy.app);
  assert.deepEqual((await candidate(legacy.app)).dlsite, {
    state: "fetched",
    title: `タイトル${CODE}`,
    cover: null,
  });
  await legacy.app.shutdown();
  assert.deepEqual(requests, { html: 1, cover: 0 });

  const current = await open(DLSITE_PARSER);
  try {
    assert.deepEqual((await candidate(current.app)).dlsite, {
      state: "cover_missing",
      title: `タイトル${CODE}`,
    });
    assert.deepEqual(requests, { html: 1, cover: 0 }, "読み直しは通信しない");

    await fetchJob(current.app);
    const after = await candidate(current.app);
    assert.equal(after.dlsite.state, "fetched");
    assert.ok(after.dlsite.state === "fetched" && after.dlsite.cover !== null);
    assert.deepEqual(requests, { html: 1, cover: 1 }, "HTMLはキャッシュを使い、画像だけ取る");

    const registered = await current.app.request("/api/scan/candidates/register", {
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
    const work = (await (await current.app.request(`/api/works/${works[0]!.workId}`)).json()) as {
      cover: unknown;
    };
    assert.ok(work.cover);
  } finally {
    await current.app.shutdown();
  }
});
