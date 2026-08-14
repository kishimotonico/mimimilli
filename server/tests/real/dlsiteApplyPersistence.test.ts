import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { DlsiteWorkInfo } from "@mimimilli/shared";
import { META_FILE_NAME } from "@mimimilli/shared";
import { createApp } from "../../src/app.ts";
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

const FAST_DLSITE_REQUEST_CONFIG = {
  ...DEFAULT_DLSITE_REQUEST_CONFIG,
  requestIntervalMs: 0,
  retryCount: 0,
  maxBackoffMs: 0,
  timeoutMs: 1_000,
};

const COVER_URL = "https://img.dlsite.jp/modpub/images2/work/a.jpg";

test("title: 単発適用は applyTitle に従い、一括取得は作品情報を変更しない", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = createTestRealAdapter({
    database: { kind: "memory" },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: (code) =>
        htmlResponse(sampleWorkHtml(code, { title: `DLsiteタイトル ${code}`, cover: false })),
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  const scan = await adapter.scan();

  const customTitle = "ユーザー編集タイトル";
  await adapter.patchWork(lib.existingWorkId, { title: customTitle });
  const existingBeforeBulk = await adapter.getWork(lib.existingWorkId);
  assert.equal(existingBeforeBulk?.title, customTitle);
  const existingMetaPath = join(existingBeforeBulk!.physicalPath, META_FILE_NAME);
  const existingBytesBeforeBulk = readFileSync(existingMetaPath);

  await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
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
      coverUrl: null,
      url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
    },
    applyTitle: true,
    applyTags: [],
    applyCover: false,
    applyUrl: true,
    sourceRevision: (await adapter.getWork(lib.existingWorkId))!.sourceRevision!,
  });
  const existingAfterApply = await adapter.getWork(lib.existingWorkId);
  assert.equal(existingAfterApply?.title, applyTitle);

  const registration = await adapter.registerScanCandidates(
    scan.candidates.map((candidate) => ({ path: candidate.path })),
  );
  const generatedId = registration.registered[0]!.workId;
  const generatedBefore = await adapter.getWork(generatedId);
  await adapter.runDlsiteBulk("existing", [generatedId]);
  const generatedAfterBulk = await adapter.getWork(generatedId);
  assert.equal(generatedAfterBulk?.title, generatedBefore?.title);

  await adapter.dlsiteApply(generatedId, {
    info: {
      rjCode: generatedBefore!.dlsite.rjCode!,
      title: "単発では上書きしない",
      circle: null,
      cvs: [],
      genreTags: [],
      coverUrl: null,
      url: `https://www.dlsite.com/maniax/work/=/product_id/${generatedBefore!.dlsite.rjCode}.html`,
    },
    applyTitle: false,
    applyTags: [],
    applyCover: false,
    applyUrl: true,
    sourceRevision: (await adapter.getWork(generatedId))!.sourceRevision!,
  });
  const generatedAfterApply = await adapter.getWork(generatedId);
  assert.equal(generatedAfterApply?.title, generatedAfterBulk?.title);
  adapter.close();
});

test("cover: 単発適用は applyCover で既存カバーを上書きし、一括取得は変更しない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-cover-behavior");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let coverHttpCalls = 0;
  const coverBody = new Uint8Array(
    readFileSync(join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
  );
  const adapter = createRealAdapter({
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
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();

  const info: DlsiteWorkInfo = {
    rjCode: "RJ900002",
    title: "x",
    circle: null,
    cvs: [],
    genreTags: [],
    coverUrl: COVER_URL,
    url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
  };
  assert.equal(
    await adapter.dlsiteApply(lib.existingWorkId, {
      info,
      applyTitle: false,
      applyTags: [],
      applyCover: true,
      applyUrl: true,
      sourceRevision: (await adapter.getWork(lib.existingWorkId))!.sourceRevision!,
    }),
    true,
  );
  assert.equal(coverHttpCalls, 1);
  const withCover = await adapter.getWork(lib.existingWorkId);
  assert.ok(withCover?.cover);
  const firstCoverImage = withCover!.cover!.image;

  await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  assert.equal(coverHttpCalls, 1);
  const afterBulk = await adapter.getWork(lib.existingWorkId);
  assert.equal(afterBulk?.cover?.image, firstCoverImage);

  assert.equal(
    await adapter.dlsiteApply(lib.existingWorkId, {
      info: { ...info, coverUrl: "https://img.dlsite.jp/modpub/images2/work/b.jpg" },
      applyTitle: false,
      applyTags: [],
      applyCover: true,
      applyUrl: true,
      sourceRevision: (await adapter.getWork(lib.existingWorkId))!.sourceRevision!,
    }),
    true,
  );
  assert.equal(coverHttpCalls, 2);
  adapter.close();
});

test("登録時のDLsite指定はregistration bodyでタイトルを上書きしない", async (t) => {
  const directory = makeTestDirectory("work-register-dlsite-title");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const folder = join(root, "RJ900020_manual");
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "intro.wav"), 1);

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const formTitle = "フォームで指定したタイトル";
  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "RJ900020_manual",
      title: formTitle,
      dlsite: {
        info: {
          rjCode: "RJ900020",
          title: "DLsiteからのタイトル",
          circle: null,
          cvs: [],
          genreTags: [],
          coverUrl: null,
          url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900020.html",
        },
        applyTitle: false,
        applyTags: [],
        applyCover: false,
        applyUrl: true,
      },
    }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.title, formTitle);

  const meta = JSON.parse(readFileSync(join(folder, META_FILE_NAME), "utf-8")) as { title: string };
  assert.equal(meta.title, formTitle);
  adapter.close();
});

test("missing-only一括適用はcache結果だけを使い、既存フィールドを上書きしない", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-apply-missing-cache");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  let htmlCalls = 0;
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: (code) => {
        htmlCalls += 1;
        return htmlResponse(sampleWorkHtml(code, { title: "取得タイトル", cover: false }));
      },
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const before = await adapter.getWork(lib.existingWorkId);
  const metaPath = join(before!.physicalPath, META_FILE_NAME);
  const bytesBefore = readFileSync(metaPath);

  await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
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
    skipped: 1,
    failed: 0,
  });
  adapter.close();
});

test("missing-only一括適用はCAS競合を集計して後続作品を続行する", async (t) => {
  const directory = makeTestDirectory("dlsite-apply-missing-cas");
  const library = makeSampleLibrary();
  t.after(directory.cleanup);
  t.after(library.cleanup);
  const root = join(directory.path, "library");
  const firstId = "11111111-1111-4111-8111-111111111111";
  const secondId = "22222222-2222-4222-8222-222222222222";
  const firstDir = join(root, "RJ900101_conflict");
  const secondDir = join(root, "RJ900102_continue");
  const firstMetaPath = join(firstDir, META_FILE_NAME);
  const createWork = (directory: string, id: string, title: string) => {
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
        },
        null,
        2,
      )}\n`,
    );
  };
  createWork(firstDir, firstId, "競合する作品");
  createWork(secondDir, secondId, "後続の作品");

  let changedSource = false;
  const coverBody = new Uint8Array(
    readFileSync(join(library.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
  );
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(directory.path, "cache.sqlite") },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: (code) => htmlResponse(sampleWorkHtml(code, { cover: true })),
      cover: () => {
        if (!changedSource) {
          changedSource = true;
          const source = JSON.parse(readFileSync(firstMetaPath, "utf-8")) as { title: string };
          source.title = "外部変更済み";
          writeFileSync(firstMetaPath, `${JSON.stringify(source, null, 2)}\n`);
        }
        return jpegResponse(coverBody);
      },
    }),
  });
  t.after(() => adapter.close());
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan({ full: true });
  await adapter.runDlsiteBulk("existing", [firstId, secondId]);

  assert.deepEqual(await adapter.dlsiteApplyMissing([firstId, secondId]), {
    applied: 1,
    skipped: 0,
    failed: 1,
  });
  assert.equal(
    (JSON.parse(readFileSync(firstMetaPath, "utf-8")) as { title: string }).title,
    "外部変更済み",
  );
  assert.ok((await adapter.getWork(secondId))?.tags.length);
});

test("missing-only一括適用: 取得失敗後もcatalog投影で通知集計へ反映される", async (t) => {
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-apply-missing-failure-projection");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const adapter = createRealAdapter({
    database: { kind: "memory" },
    dlsiteCache: { path: join(dir.path, "cache.sqlite") },
    dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
    dlsiteSchedulerDependencies: mockDlsiteTransport({
      html: () => htmlResponse("<html>404</html>", 404),
    }),
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const metaPath = join((await adapter.getWork(lib.existingWorkId))!.physicalPath, META_FILE_NAME);
  const bytesBefore = readFileSync(metaPath);

  assert.deepEqual(await adapter.dlsiteApplyMissing([lib.existingWorkId]), {
    applied: 0,
    skipped: 0,
    failed: 1,
  });

  const work = await adapter.getWork(lib.existingWorkId);
  assert.equal(work?.dlsite.status, "not_found");
  assert.equal(work?.dlsite.errorKind, "not_found");
  assert.deepEqual(readFileSync(metaPath), bytesBefore);

  const summary = await adapter.getDlsiteNotificationSummary();
  assert.ok(summary.fetchFailedCount >= 1);
  adapter.close();
});

test("一括取得はカバーをキャッシュも適用もせず、明示適用で取得する", async (t) => {
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
  const adapter = createRealAdapter({
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
  });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();

  await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  assert.equal(coverHttpCalls, 0);

  await adapter.dlsiteApply(lib.existingWorkId, {
    info: {
      rjCode: "RJ900002",
      title: "x",
      circle: null,
      cvs: [],
      genreTags: [],
      coverUrl: bulkCoverUrl,
      url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
    },
    applyTitle: false,
    applyTags: [],
    applyCover: true,
    applyUrl: true,
    sourceRevision: (await adapter.getWork(lib.existingWorkId))!.sourceRevision!,
  });
  assert.equal(coverHttpCalls, 1);
  adapter.close();
});
