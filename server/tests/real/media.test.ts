// メディア配信（/api/media/*）の結合テスト: ストリーミング・Range・パストラバーサル遮断。
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { WorksPage } from "@mimimilli/shared";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { WorkQueryRepository } from "../../src/adapters/real/workQueryRepository.ts";
import { createApp } from "../../src/app.ts";
import { scanAndRegisterCandidates } from "../helpers/scanLibrary.ts";
import { makeSampleLibrary, makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

async function setup(t: TestContext, chunkSizeBytes?: number) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  // ルート直下（作品フォルダー外）に「秘密ファイル」を置き、トラバーサルの検証に使う
  writeFileSync(join(lib.root, "secret.txt"), "library-secret");
  const adapter = lib.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter, chunkSizeBytes ? { media: { chunkSizeBytes } } : undefined);
  await adapter.updateSettings({ rootFolder: lib.root });
  await scanAndRegisterCandidates(adapter);

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

test("音声配信: 開放端Rangeは上限チャンクサイズで打ち切った206を返す（サーバー側読み取り量が有界）", async (t) => {
  // 01_intro.wav は 32044 バイト。チャンク上限を1000バイトに絞り、要求の残り全体（32000バイト）ではなく
  // 上限どおりに打ち切られることを確認する。
  const { app, generated } = await setup(t, 1000);

  const res = await app.request(`/api/media/audio/${generated.id}/mp3/01_intro.wav`, {
    headers: { Range: "bytes=44-" },
  });
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("content-range"), "bytes 44-1043/32044");
  assert.equal(res.headers.get("content-length"), "1000");
  assert.equal((await res.arrayBuffer()).byteLength, 1000);
});

test("音声配信: 閉区間Range（bytes=N-M）は上限を超えても指定範囲全体を返す", async (t) => {
  const { app, generated } = await setup(t, 1000);

  const res = await app.request(`/api/media/audio/${generated.id}/mp3/01_intro.wav`, {
    headers: { Range: "bytes=44-30043" },
  });
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("content-range"), "bytes 44-30043/32044");
  assert.equal(res.headers.get("content-length"), "30000");
  assert.equal((await res.arrayBuffer()).byteLength, 30000);
});

test("音声配信: 末尾指定Range（bytes=-N）は上限を超えても指定量全体を返す", async (t) => {
  const { app, generated } = await setup(t, 1000);

  const res = await app.request(`/api/media/audio/${generated.id}/mp3/01_intro.wav`, {
    headers: { Range: "bytes=-30000" },
  });
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("content-range"), "bytes 2044-32043/32044");
  assert.equal(res.headers.get("content-length"), "30000");
  assert.equal((await res.arrayBuffer()).byteLength, 30000);
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
    join(workDir, "mimimilli.json"),
    JSON.stringify(
      {
        formatVersion: 1,
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

  const originalFetchWorkDetail = WorkQueryRepository.prototype.fetchWorkDetail;
  const originalFetchProbeCache = WorkQueryRepository.prototype.fetchProbeCache;
  let fetchWorkDetailCalls = 0;
  let fetchProbeCacheCalls = 0;
  WorkQueryRepository.prototype.fetchWorkDetail = function (...args) {
    fetchWorkDetailCalls += 1;
    return originalFetchWorkDetail.apply(this, args);
  };
  WorkQueryRepository.prototype.fetchProbeCache = function (...args) {
    fetchProbeCacheCalls += 1;
    return originalFetchProbeCache.apply(this, args);
  };

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();

  try {
    fetchWorkDetailCalls = 0;
    fetchProbeCacheCalls = 0;

    const audio = await app.request(`/api/media/audio/${workId}/track-00.wav`);
    assert.equal(audio.status, 200);

    const file = await app.request(`/api/media/file/${workId}/track-29.wav`);
    assert.equal(file.status, 200);

    const missing = await app.request(`/api/media/file/${workId}/no-such.wav`);
    assert.equal(missing.status, 404);

    assert.equal(fetchWorkDetailCalls, 0, "locateMedia must not call fetchWorkDetail");
    assert.equal(fetchProbeCacheCalls, 0, "locateMedia must not fetch probe cache");
  } finally {
    WorkQueryRepository.prototype.fetchWorkDetail = originalFetchWorkDetail;
    WorkQueryRepository.prototype.fetchProbeCache = originalFetchProbeCache;
  }
});
