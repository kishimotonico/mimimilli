import { REGISTER_ALL } from "../helpers/scanLibrary.ts";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { META_FILE_NAME } from "@mimimilli/shared";
import { CoverSaveError } from "../../src/errors.ts";
import { createApp } from "../helpers/testApp.ts";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../../src/adapters/real/dlsiteConfig.ts";
import {
  htmlResponse,
  jpegResponse,
  mockDlsiteTransport,
  sampleWorkHtml,
} from "../helpers/dlsiteTransport.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { makeSampleLibrary, makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";
import { configureRoot } from "../helpers/rootFolder.ts";
import { fetchDlsiteOfWorks } from "../helpers/dlsiteFetch.ts";

const FAST_DLSITE_REQUEST_CONFIG = {
  ...DEFAULT_DLSITE_REQUEST_CONFIG,
  requestIntervalMs: 0,
  retryCount: 0,
  maxBackoffMs: 0,
  timeoutMs: 1_000,
};

test("title: 単発適用は applyTitle に従い、一括取得は作品情報を変更しない", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = lib.own(
    createTestRealAdapter({
      database: { kind: "memory" },
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) =>
          htmlResponse(sampleWorkHtml(code, { title: `DLsiteタイトル ${code}`, cover: false })),
      }),
    }),
  );
  await configureRoot(adapter, lib.root);
  await adapter.scan();

  const customTitle = "ユーザー編集タイトル";
  const snap = await adapter.getWorkEditSnapshot(lib.existingWorkId);
  await adapter.patchWorkSource(lib.existingWorkId, {
    sourceRevision: snap!.sourceRevision,
    title: customTitle,
  });
  const existingBeforeBulk = await adapter.getWork(lib.existingWorkId);
  assert.equal(existingBeforeBulk?.title, customTitle);
  const existingMetaPath = join(existingBeforeBulk!.physicalPath, META_FILE_NAME);
  const existingBytesBeforeBulk = readFileSync(existingMetaPath);

  await fetchDlsiteOfWorks(adapter, [lib.existingWorkId]);
  const existingAfterBulk = await adapter.getWork(lib.existingWorkId);
  assert.equal(existingAfterBulk?.title, customTitle);
  assert.deepEqual(readFileSync(existingMetaPath), existingBytesBeforeBulk);
  assert.deepEqual(existingAfterBulk?.tags, existingBeforeBulk?.tags);

  const applyTitle = "単発適用タイトル";
  await adapter.dlsiteApply(lib.existingWorkId, {
    info: {
      rjCode: "RJ900002",
      title: applyTitle,
      circle: null,
      cvs: [],
      genreTags: [],
      ageRating: null,
      coverUrl: null,
      url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
    },
    applyTitle: true,
    applyTags: [],
    applyCover: false,
    applyUrl: true,
    sourceRevision: (await adapter.getWorkEditSnapshot(lib.existingWorkId))!.sourceRevision,
  });
  const existingAfterApply = await adapter.getWork(lib.existingWorkId);
  assert.equal(existingAfterApply?.title, applyTitle);

  const registration = await adapter.registerScanCandidates(
    (await adapter.listScanCandidates()).map((candidate) => candidate.path),
    REGISTER_ALL,
  );
  const generatedId = registration.registered[0]!.workId;
  const generatedBefore = await adapter.getWork(generatedId);
  await fetchDlsiteOfWorks(adapter, [generatedId]);
  const generatedAfterBulk = await adapter.getWork(generatedId);
  assert.equal(generatedAfterBulk?.title, generatedBefore?.title);

  await adapter.dlsiteApply(generatedId, {
    info: {
      rjCode: generatedBefore!.dlsite.rjCode!,
      title: "単発では上書きしない",
      circle: null,
      cvs: [],
      genreTags: [],
      ageRating: null,
      coverUrl: null,
      url: `https://www.dlsite.com/maniax/work/=/product_id/${generatedBefore!.dlsite.rjCode}.html`,
    },
    applyTitle: false,
    applyTags: [],
    applyCover: false,
    applyUrl: true,
    sourceRevision: (await adapter.getWorkEditSnapshot(generatedId))!.sourceRevision,
  });
  const generatedAfterApply = await adapter.getWork(generatedId);
  assert.equal(generatedAfterApply?.title, generatedAfterBulk?.title);
});

test("cover: 単発適用は先取りしたカバーを適用し、一括取得は変更せず、キャッシュに無いカバーは取りに行かない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-cover-behavior");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let coverHttpCalls = 0;
  const coverBody = new Uint8Array(
    readFileSync(join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
  );
  const adapter = dir.own(
    createRealAdapter({
      database: { kind: "memory" },
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteCache: { path: join(dir.path, "cache.sqlite") },
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) => htmlResponse(sampleWorkHtml(code, { title: `取得 ${code}`, cover: true })),
        cover: () => {
          coverHttpCalls += 1;
          return jpegResponse(coverBody);
        },
      }),
    }),
  );
  await configureRoot(adapter, lib.root);
  await adapter.scan();

  const fetched = await adapter.dlsiteFetchByCode("RJ900002");
  assert.equal(fetched.ok, true);
  const info = (fetched as Extract<typeof fetched, { ok: true }>).info;
  assert.equal(coverHttpCalls, 1);
  assert.ok(
    (
      await adapter.dlsiteApply(lib.existingWorkId, {
        info,
        applyTitle: false,
        applyTags: [],
        applyCover: true,
        applyUrl: true,
        sourceRevision: (await adapter.getWorkEditSnapshot(lib.existingWorkId))!.sourceRevision,
      })
    )?.snapshot,
  );
  assert.equal(coverHttpCalls, 1);
  const withCover = await adapter.getWork(lib.existingWorkId);
  assert.ok(withCover?.cover);
  const firstCoverImage = withCover!.cover!.image;

  await fetchDlsiteOfWorks(adapter, [lib.existingWorkId]);
  assert.equal(coverHttpCalls, 1);
  const afterBulk = await adapter.getWork(lib.existingWorkId);
  assert.equal(afterBulk?.cover?.image, firstCoverImage);

  await assert.rejects(
    async () =>
      adapter.dlsiteApply(lib.existingWorkId, {
        info: { ...info, coverUrl: "https://img.dlsite.jp/modpub/images2/work/b.jpg" },
        applyTitle: false,
        applyTags: [],
        applyCover: true,
        applyUrl: true,
        sourceRevision: (await adapter.getWorkEditSnapshot(lib.existingWorkId))!.sourceRevision,
      }),
    CoverSaveError,
  );
  assert.equal(coverHttpCalls, 1);
});

test("Filesの作品登録はキャッシュのDLsite情報を使い、タイトルは入力のまま、bodyのinfoは使わない", async (t) => {
  const directory = makeTestDirectory("work-register-dlsite-title");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const folder = join(root, "RJ900020_manual");
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "intro.wav"), 1);

  const adapter = directory.own(
    createTestRealAdapter({
      database: { kind: "memory" },
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) => htmlResponse(sampleWorkHtml(code, { title: "DLsiteからのタイトル" })),
      }),
    }),
  );
  const app = createApp(adapter);
  await configureRoot(adapter, root);
  const fetched = await adapter.dlsiteFetchByCode("RJ900020");
  assert.equal(fetched.ok, true);
  const cachedUrl = (fetched as Extract<typeof fetched, { ok: true }>).info.url;

  const formTitle = "フォームで指定したタイトル";
  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "RJ900020_manual",
      title: formTitle,
      rjCode: "RJ900020",
      applyCover: false,
      applyUrl: true,
      info: {
        rjCode: "RJ900020",
        title: "偽のタイトル",
        circle: null,
        cvs: [],
        genreTags: [],
        ageRating: null,
        coverUrl: null,
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ999999.html",
      },
    }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.snapshot.title, formTitle);

  const meta = JSON.parse(readFileSync(join(folder, META_FILE_NAME), "utf-8")) as {
    title: string;
    urls: Array<{ label: string; url: string }>;
  };
  assert.equal(meta.title, formTitle);
  assert.deepEqual(meta.urls, [{ label: "DLsite", url: cachedUrl }]);
});

test("取得はカバーをキャッシュへ先取りし、明示適用はキャッシュのカバーを使ってHTTPしない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-shared-cache");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let coverHttpCalls = 0;
  const coverBody = new Uint8Array(
    readFileSync(join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
  );
  const bulkCoverUrl =
    "https://img.dlsite.jp/modpub/images2/work/doujin/RJ900000/RJ900002_img_main.jpg";
  const adapter = dir.own(
    createRealAdapter({
      database: { kind: "memory" },
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteCache: { path: join(dir.path, "cache.sqlite") },
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) => htmlResponse(sampleWorkHtml(code, { title: `取得 ${code}`, cover: true })),
        cover: () => {
          coverHttpCalls += 1;
          return jpegResponse(coverBody);
        },
      }),
    }),
  );
  await configureRoot(adapter, lib.root);
  await adapter.scan();

  await fetchDlsiteOfWorks(adapter, [lib.existingWorkId]);
  assert.equal(coverHttpCalls, 1);
  const workDir = (await adapter.getWork(lib.existingWorkId))!.physicalPath;
  assert.equal(existsSync(join(workDir, "dlsite_cover.jpg")), false);

  await adapter.dlsiteApply(lib.existingWorkId, {
    info: {
      rjCode: "RJ900002",
      title: "x",
      circle: null,
      cvs: [],
      genreTags: [],
      ageRating: null,
      coverUrl: bulkCoverUrl,
      url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
    },
    applyTitle: false,
    applyTags: [],
    applyCover: true,
    applyUrl: true,
    sourceRevision: (await adapter.getWorkEditSnapshot(lib.existingWorkId))!.sourceRevision,
  });
  assert.equal(coverHttpCalls, 1);
  assert.equal(existsSync(join(workDir, "dlsite_cover.jpg")), true);
});

async function setupSampleAdapter(t: { after: (fn: () => void) => void }, html: () => Response) {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-apply-state");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const adapter = dir.own(
    createRealAdapter({
      database: { kind: "memory" },
      dlsiteCache: { path: join(dir.path, "cache.sqlite") },
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteSchedulerDependencies: mockDlsiteTransport({ html }),
    }),
  );
  await configureRoot(adapter, lib.root);
  await adapter.scan();
  const work = await adapter.getWork(lib.existingWorkId);
  return {
    adapter,
    work: work!,
    id: lib.existingWorkId,
    metaPath: join(work!.physicalPath, META_FILE_NAME),
  };
}

test("取得失敗のあとも作品情報ファイルは書き換わらず、dlsiteのstatusとerrorKindがnot_foundで残る", async (t) => {
  const { adapter, id, metaPath } = await setupSampleAdapter(t, () =>
    htmlResponse("<html>404</html>", 404),
  );
  const bytesBefore = readFileSync(metaPath);

  await fetchDlsiteOfWorks(adapter, [id]);

  const work = await adapter.getWork(id);
  assert.equal(work?.dlsite.status, "not_found");
  assert.equal(work?.dlsite.errorKind, "not_found");
  assert.deepEqual(readFileSync(metaPath), bytesBefore);
});

async function applyBodyOf(
  adapter: Awaited<ReturnType<typeof setupSampleAdapter>>["adapter"],
  id: string,
) {
  return {
    info: {
      rjCode: "RJ900002",
      title: "適用タイトル",
      circle: "夜想曲",
      cvs: [],
      genreTags: ["耳かき"],
      ageRating: null,
      coverUrl: null,
      url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
    },
    applyTitle: true,
    applyTags: ["genre/耳かき"] as never,
    applyCover: false,
    applyUrl: true,
    sourceRevision: (await adapter.getWorkEditSnapshot(id))!.sourceRevision,
  };
}

test("単体適用: 作品情報ファイルが壊れていればエラーになり何も書かれない", async (t) => {
  const { adapter, id, metaPath } = await setupSampleAdapter(t, () =>
    htmlResponse(sampleWorkHtml("RJ900002", { cover: false })),
  );
  const body = await applyBodyOf(adapter, id);
  writeFileSync(metaPath, "{ not json");

  await assert.rejects(adapter.dlsiteApply(id, body));

  assert.equal(readFileSync(metaPath, "utf-8"), "{ not json");
});

test("単体適用: 作品情報ファイルのidが食い違えばエラーになり何も書かれない", async (t) => {
  const { adapter, id, metaPath } = await setupSampleAdapter(t, () =>
    htmlResponse(sampleWorkHtml("RJ900002", { cover: false })),
  );
  const body = await applyBodyOf(adapter, id);
  const raw = JSON.parse(readFileSync(metaPath, "utf-8")) as { id: string };
  raw.id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const mismatched = `${JSON.stringify(raw, null, 2)}\n`;
  writeFileSync(metaPath, mismatched);

  await assert.rejects(adapter.dlsiteApply(id, body));

  assert.equal(readFileSync(metaPath, "utf-8"), mismatched);
});
