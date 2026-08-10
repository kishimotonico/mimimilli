import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
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

test("title: 単発適用は applyTitle に従い、一括取得は既定タイトルのみ更新する", async (t) => {
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

  await adapter.runDlsiteBulk("existing", [lib.existingWorkId]);
  const existingAfterBulk = await adapter.getWork(lib.existingWorkId);
  assert.equal(existingAfterBulk?.title, customTitle);

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
  });
  const existingAfterApply = await adapter.getWork(lib.existingWorkId);
  assert.equal(existingAfterApply?.title, applyTitle);

  const generatedId = scan.newWorkIds[0]!;
  const generatedBefore = await adapter.getWork(generatedId);
  await adapter.runDlsiteBulk("existing", [generatedId]);
  const generatedAfterBulk = await adapter.getWork(generatedId);
  assert.equal(generatedAfterBulk?.title, `DLsiteタイトル ${generatedBefore?.dlsite.rjCode}`);

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
  });
  const generatedAfterApply = await adapter.getWork(generatedId);
  assert.equal(generatedAfterApply?.title, generatedAfterBulk?.title);
  adapter.close();
});

test("cover: 単発適用は applyCover で既存カバーを上書きし、一括取得はカバー未設定時のみ取得する", async (t) => {
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
    }),
    true,
  );
  assert.equal(coverHttpCalls, 2);
  adapter.close();
});

test("手動登録: applyTitle=false のときフォーム title を保持し DLsite title は使わない", async (t) => {
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
      path: folder,
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

test("cache: カバー取得は単発適用・一括取得のいずれも transport cache を共有する", async (t) => {
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
  assert.equal(coverHttpCalls, 1);

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
  });
  assert.equal(coverHttpCalls, 1);
  adapter.close();
});
