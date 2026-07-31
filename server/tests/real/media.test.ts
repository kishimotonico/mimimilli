// メディア配信（/api/media/*）の結合テスト: ストリーミング・Range・パストラバーサル遮断。
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { WorksPage } from "@mimimilli/shared";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { WorkRepo } from "../../src/adapters/real/workRepo.ts";
import { createApp } from "../../src/app.ts";
import { makeSampleLibrary, makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

async function setup(t: TestContext) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  // ルート直下（作品フォルダー外）に「秘密ファイル」を置き、トラバーサルの検証に使う
  writeFileSync(join(lib.root, "secret.txt"), "library-secret");
  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();

  const res = await app.request("/api/works");
  const works = (await res.json()) as WorksPage;
  const generated = works.items.find((w) => w.title.includes("RJ900001"))!;
  const existing = works.items.find((w) => w.title === "既存メタの作品")!;
  return { app, generated, existing };
}

test("音声配信: 200 全体取得と Range 206", async (t) => {
  const { app, generated } = await setup(t);

  const whole = await app.request(`/api/media/audio/${generated.id}/mp3/01_intro.wav`);
  assert.equal(whole.status, 200);
  assert.equal(whole.headers.get("content-type"), "audio/wav");
  assert.equal(whole.headers.get("accept-ranges"), "bytes");

  const part = await app.request(`/api/media/audio/${generated.id}/mp3/01_intro.wav`, {
    headers: { Range: "bytes=44-143" },
  });
  assert.equal(part.status, 206);
  assert.match(part.headers.get("content-range") ?? "", /^bytes 44-143\/\d+$/);
  assert.equal((await part.arrayBuffer()).byteLength, 100);
});

test("パストラバーサル: ../ を含む相対パスは 404", async (t) => {
  const { app, generated } = await setup(t);
  for (const rel of [
    "..%2Fsecret.txt",
    "..%2F..%2F..%2Fetc%2Fpasswd",
    "mp3%2F..%2F..%2Fsecret.txt",
  ]) {
    const res = await app.request(`/api/media/file/${generated.id}/${rel}`);
    assert.equal(res.status, 404, `should block: ${rel}`);
  }
});

test("カバー画像: coverImage あり 200 / なし 404 / 作品なし 404", async (t) => {
  const { app, generated, existing } = await setup(t);

  const ok = await app.request(`/api/media/cover/${generated.id}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/jpeg");

  assert.equal((await app.request(`/api/media/cover/${existing.id}`)).status, 404);
  assert.equal((await app.request("/api/media/cover/no-such-work")).status, 404);
});

test("メディア解決: getWork・probe cache問い合わせを伴わない", async (t) => {
  const directory = makeTestDirectory("media-locate-lightweight");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "RJ900020_多トラック");
  mkdirSync(workDir, { recursive: true });

  const workId = crypto.randomUUID();
  const playlistId = crypto.randomUUID();
  const tracks = Array.from({ length: 30 }, (_, index) => {
    const file = `track-${String(index).padStart(2, "0")}.wav`;
    writeWav(join(workDir, file), 1);
    return { id: crypto.randomUUID(), title: `track ${index}`, file };
  });
  writeFileSync(
    join(workDir, ".meta.json"),
    JSON.stringify(
      {
        id: workId,
        title: "多トラック作品",
        tags: [],
        defaultPlaylistId: playlistId,
        playlists: [{ id: playlistId, name: "default", tracks }],
      },
      null,
      2,
    ),
  );

  const originalGetWork = WorkRepo.prototype.getWork;
  const originalFetchProbeCache = WorkRepo.prototype.fetchProbeCache;
  let getWorkCalls = 0;
  let fetchProbeCacheCalls = 0;
  WorkRepo.prototype.getWork = async function (...args) {
    getWorkCalls += 1;
    return originalGetWork.apply(this, args);
  };
  WorkRepo.prototype.fetchProbeCache = function (...args) {
    fetchProbeCacheCalls += 1;
    return originalFetchProbeCache.apply(this, args);
  };

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();

  try {
    getWorkCalls = 0;
    fetchProbeCacheCalls = 0;

    const audio = await app.request(`/api/media/audio/${workId}/track-00.wav`);
    assert.equal(audio.status, 200);

    const file = await app.request(`/api/media/file/${workId}/track-29.wav`);
    assert.equal(file.status, 200);

    const missing = await app.request(`/api/media/file/${workId}/no-such.wav`);
    assert.equal(missing.status, 404);

    assert.equal(getWorkCalls, 0, "locateMedia must not call getWork");
    assert.equal(fetchProbeCacheCalls, 0, "locateMedia must not fetch probe cache");
  } finally {
    WorkRepo.prototype.getWork = originalGetWork;
    WorkRepo.prototype.fetchProbeCache = originalFetchProbeCache;
  }
});
