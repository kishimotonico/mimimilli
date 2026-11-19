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

test("missing-only一括適用はcache結果だけを使い、既存フィールドを上書きしない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-apply-missing-cache");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let htmlCalls = 0;
  const adapter = dir.own(
    createRealAdapter({
      database: { kind: "memory" },
      dlsiteCache: { path: join(dir.path, "cache.sqlite") },
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) => {
          htmlCalls += 1;
          return htmlResponse(sampleWorkHtml(code, { title: "取得タイトル", cover: false }));
        },
      }),
    }),
  );
  await configureRoot(adapter, lib.root);
  await adapter.scan();
  const before = await adapter.getWork(lib.existingWorkId);
  const metaPath = join(before!.physicalPath, META_FILE_NAME);
  const bytesBefore = readFileSync(metaPath);

  await fetchDlsiteOfWorks(adapter, [lib.existingWorkId]);
  assert.equal(htmlCalls, 1);
  assert.deepEqual(readFileSync(metaPath), bytesBefore);

  const applied = await adapter.dlsiteApplyMissing([lib.existingWorkId]);
  assert.equal(applied.applied, 1);
  assert.equal(htmlCalls, 1);
  const after = await adapter.getWork(lib.existingWorkId);
  assert.equal(after?.title, before?.title);
  assert.notDeepEqual(readFileSync(metaPath), bytesBefore);
  assert.ok(after?.tags.length && after.tags.length > before!.tags.length);

  assert.deepEqual(await adapter.dlsiteApplyMissing([lib.existingWorkId]), {
    applied: 0,
    pending: 0,
    skipped: 1,
    failed: 0,
  });
});

test("missing-only一括適用プレビューは書き込みをせず、適用と同じ差分を返す", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-apply-missing-preview");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const adapter = dir.own(
    createRealAdapter({
      database: { kind: "memory" },
      dlsiteCache: { path: join(dir.path, "cache.sqlite") },
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) => htmlResponse(sampleWorkHtml(code, { title: "取得タイトル", cover: false })),
      }),
    }),
  );
  await configureRoot(adapter, lib.root);
  await adapter.scan();
  const before = await adapter.getWork(lib.existingWorkId);
  const metaPath = join(before!.physicalPath, META_FILE_NAME);
  const bytesBefore = readFileSync(metaPath);

  await fetchDlsiteOfWorks(adapter, [lib.existingWorkId]);

  const preview = await adapter.dlsiteApplyMissingPreview([lib.existingWorkId]);
  assert.equal(preview.items.length, 1);
  assert.equal(preview.items[0]?.workId, lib.existingWorkId);
  assert.ok(preview.items[0]!.newTags.length > 0);
  assert.deepEqual(readFileSync(metaPath), bytesBefore, "プレビューはmetaを書き換えない");

  const applied = await adapter.dlsiteApplyMissing([lib.existingWorkId]);
  assert.equal(applied.applied, 1);
  const after = await adapter.getWork(lib.existingWorkId);
  assert.deepEqual(
    preview.items[0]!.newTags.sort(),
    after!.tags.filter((tag) => !before!.tags.includes(tag)).sort(),
  );

  assert.deepEqual(await adapter.dlsiteApplyMissingPreview([lib.existingWorkId]), { items: [] });
});

function writeMinimalLibraryWork(directory: string, id: string, title: string, rjCode: string) {
  mkdirSync(directory, { recursive: true });
  writeWav(join(directory, "track.wav"), 1);
  writeFileSync(
    join(directory, META_FILE_NAME),
    `${JSON.stringify(
      {
        formatVersion: 1,
        id,
        title,
        playlists: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            name: "default",
            tracks: [
              {
                id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                title: "本編",
                file: "track.wav",
              },
            ],
          },
        ],
        defaultPlaylistId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        dlsite: {
          rjCode,
          status: "none",
          lastAttemptAt: null,
          error: null,
          errorKind: null,
          appliedTags: [],
        },
      },
      null,
      2,
    )}\n`,
  );
}

async function setupTwoWorkMissingApply(t: { after: (fn: () => void) => void }, name: string) {
  const directory = makeTestDirectory(name);
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const firstId = "11111111-1111-4111-8111-111111111111";
  const secondId = "22222222-2222-4222-8222-222222222222";
  const firstDir = join(root, "RJ900101_first");
  const secondDir = join(root, "RJ900102_continue");
  const firstMetaPath = join(firstDir, META_FILE_NAME);
  writeMinimalLibraryWork(firstDir, firstId, "壊す作品", "RJ900101");
  writeMinimalLibraryWork(secondDir, secondId, "後続の作品", "RJ900102");
  const adapter = directory.own(
    createRealAdapter({
      database: { kind: "memory" },
      dlsiteCache: { path: join(directory.path, "cache.sqlite") },
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) => htmlResponse(sampleWorkHtml(code, { cover: false })),
      }),
    }),
  );
  await configureRoot(adapter, root);
  await adapter.scan({ full: true });
  await fetchDlsiteOfWorks(adapter, [firstId, secondId]);
  return { adapter, firstId, secondId, firstMetaPath };
}

test("missing-only一括適用は1件のidentity不一致を集計して後続作品を続行する", async (t) => {
  const { adapter, firstId, secondId, firstMetaPath } = await setupTwoWorkMissingApply(
    t,
    "dlsite-apply-missing-identity",
  );
  const raw = JSON.parse(readFileSync(firstMetaPath, "utf-8")) as { id: string };
  raw.id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  writeFileSync(firstMetaPath, `${JSON.stringify(raw, null, 2)}\n`);

  assert.deepEqual(await adapter.dlsiteApplyMissing([firstId, secondId]), {
    applied: 1,
    pending: 0,
    skipped: 0,
    failed: 1,
  });
  assert.equal(JSON.parse(readFileSync(firstMetaPath, "utf-8")).id, raw.id);
  assert.ok((await adapter.getWork(secondId))?.tags.length);
});

test("missing-only一括適用は1件の壊れたJSONをfailedに数え後続作品を続行する", async (t) => {
  const { adapter, firstId, secondId, firstMetaPath } = await setupTwoWorkMissingApply(
    t,
    "dlsite-apply-missing-parse-error",
  );
  writeFileSync(firstMetaPath, "{ not json");

  assert.deepEqual(await adapter.dlsiteApplyMissing([firstId, secondId]), {
    applied: 1,
    pending: 0,
    skipped: 0,
    failed: 1,
  });
  assert.equal(readFileSync(firstMetaPath, "utf-8"), "{ not json");
  assert.ok((await adapter.getWork(secondId))?.tags.length);
});

test("missing-only一括適用: 取得失敗後もcatalog投影で通知集計へ反映される", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-apply-missing-failure-projection");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const adapter = dir.own(
    createRealAdapter({
      database: { kind: "memory" },
      dlsiteCache: { path: join(dir.path, "cache.sqlite") },
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: () => htmlResponse("<html>404</html>", 404),
      }),
    }),
  );
  await configureRoot(adapter, lib.root);
  await adapter.scan();
  const metaPath = join((await adapter.getWork(lib.existingWorkId))!.physicalPath, META_FILE_NAME);
  const bytesBefore = readFileSync(metaPath);

  assert.deepEqual(await adapter.dlsiteApplyMissing([lib.existingWorkId]), {
    applied: 0,
    pending: 0,
    skipped: 0,
    failed: 1,
  });

  const work = await adapter.getWork(lib.existingWorkId);
  assert.equal(work?.dlsite.status, "not_found");
  assert.equal(work?.dlsite.errorKind, "not_found");
  assert.deepEqual(readFileSync(metaPath), bytesBefore);

  const summary = await adapter.getDlsiteNotificationSummary();
  assert.ok(summary.fetchFailedCount >= 1);
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
