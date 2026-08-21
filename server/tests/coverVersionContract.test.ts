import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import sharp from "sharp";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { deriveCoverVersion } from "../src/adapter/media.ts";
import type { WorksPage } from "@mimimilli/shared";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { scanAndRegisterCandidates } from "./helpers/scanLibrary.ts";
import { makeSampleLibrary, writeSampleCover } from "./helpers/sampleLibrary.ts";

test("fixture: measured cover DTO に version が付き、同一内容なら安定する", async () => {
  const adapter = createFixtureAdapter();
  const first = await adapter.getWork("RJ501001");
  const second = await adapter.getWork("RJ501001");
  assert.ok(first?.cover);
  assert.ok(second?.cover);
  assert.equal(typeof first.cover.version, "string");
  assert.equal(first.cover.version.length > 0, true);
  assert.equal(first.cover.version, second.cover.version);
});

test("fixture: カバー内容が変わると version が変わる", async () => {
  const adapter = createFixtureAdapter();
  const before = await adapter.getWork("RJ501001");
  assert.ok(before?.cover);
  const previousVersion = before.cover.version;

  await adapter.dlsiteApply("RJ501001", {
    applyTitle: true,
    applyTags: [],
    applyCover: false,
    applyUrl: false,
    sourceRevision: before.sourceRevision!,
    info: {
      rjCode: "RJ501001",
      title: "カバー内容更新後タイトル",
      circle: null,
      cvs: [],
      genreTags: [],
      coverUrl: null,
      url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501001.html",
    },
  });

  const after = await adapter.getWork("RJ501001");
  assert.ok(after?.cover);
  assert.notEqual(after.cover.version, previousVersion);
});

test("real: カバーファイル差し替えで version と describeCover ETag が変わる", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const coverPath = join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg");
  await sharp({
    create: { width: 120, height: 120, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .jpeg()
    .toFile(coverPath);

  const adapter = lib.own(
    createTestRealAdapter({
      database: { kind: "memory" },
      thumbnailCacheDir: join(lib.baseDir, "cache"),
    }),
  );
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: lib.root });
  await scanAndRegisterCandidates(adapter);

  const works = (await (await app.request("/api/works")).json()) as WorksPage;
  const work = works.items.find((item) => item.title.includes("RJ900001"));
  assert.ok(work?.cover);
  const versionBefore = work.cover.version;
  const descriptorBefore = await adapter.describeCover(work.id);
  assert.ok(descriptorBefore);

  await sharp({
    create: { width: 120, height: 120, channels: 3, background: { r: 200, g: 50, b: 10 } },
  })
    .jpeg()
    .toFile(coverPath);

  const refreshed = await adapter.getWork(work.id);
  assert.ok(refreshed?.cover);
  const descriptorAfter = await adapter.describeCover(work.id);
  assert.ok(descriptorAfter);

  assert.notEqual(refreshed.cover.version, versionBefore);
  assert.notEqual(descriptorAfter.etag, descriptorBefore.etag);
  const coverStat = await stat(coverPath);
  assert.equal(
    refreshed.cover.version,
    deriveCoverVersion(work.id, undefined, { size: coverStat.size, mtimeMs: coverStat.mtimeMs }),
  );
});

async function setupRealCoverRoute(t: TestContext) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const coverPath = join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg");
  writeSampleCover(coverPath);
  const adapter = lib.own(
    createTestRealAdapter({
      database: { kind: "memory" },
      thumbnailCacheDir: join(lib.baseDir, "cache"),
    }),
  );
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: lib.root });
  await scanAndRegisterCandidates(adapter);
  const works = (await (await app.request("/api/works")).json()) as WorksPage;
  const work = works.items.find((item) => item.title.includes("RJ900001"));
  assert.ok(work?.cover);
  return { app, adapter, work };
}

test("real: v付きカバーは immutable Cache-Control、v無しは must-revalidate", async (t) => {
  const { app, work } = await setupRealCoverRoute(t);
  const version = work.cover!.version;

  const immutable = await app.request(`/api/media/cover/${work.id}?v=${version}`);
  assert.equal(immutable.status, 200);
  assert.equal(immutable.headers.get("cache-control"), "private, max-age=31536000, immutable");

  const revalidate = await app.request(`/api/media/cover/${work.id}`);
  assert.equal(revalidate.status, 200);
  assert.equal(revalidate.headers.get("cache-control"), "private, max-age=0, must-revalidate");
});

test("real: v無しは ETag 一致で 304、v付きは 304 にしない", async (t) => {
  const { app, adapter, work } = await setupRealCoverRoute(t);
  const version = work.cover!.version;
  const descriptor = await adapter.describeCover(work.id);
  assert.ok(descriptor);

  const withoutVersion = await app.request(`/api/media/cover/${work.id}`, {
    headers: { "If-None-Match": descriptor.etag },
  });
  assert.equal(withoutVersion.status, 304);

  const withVersion = await app.request(`/api/media/cover/${work.id}?v=${version}`, {
    headers: { "If-None-Match": descriptor.etag },
  });
  assert.equal(withVersion.status, 200);
  assert.equal(withVersion.headers.get("cache-control"), "private, max-age=31536000, immutable");
});

test("fixture: v付きカバーは immutable Cache-Control、v無しは must-revalidate", async () => {
  const app = createApp(createFixtureAdapter());
  const work = await createFixtureAdapter().getWork("RJ501001");
  assert.ok(work?.cover);
  const version = work.cover.version;

  const immutable = await app.request(`/api/media/cover/RJ501001?v=${version}`);
  assert.equal(immutable.status, 200);
  assert.equal(immutable.headers.get("cache-control"), "private, max-age=31536000, immutable");

  const revalidate = await app.request("/api/media/cover/RJ501001");
  assert.equal(revalidate.status, 200);
  assert.equal(revalidate.headers.get("cache-control"), "private, max-age=0, must-revalidate");
});
