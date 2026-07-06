// メディア配信（/api/media/*）の結合テスト: ストリーミング・Range・パストラバーサル遮断。
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { WorksPage } from "@mimimilli/shared";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { createApp } from "../../src/app.ts";
import { makeSampleLibrary } from "../helpers/sampleLibrary.ts";

const BASE = "data/test-media";

async function setup() {
  const lib = makeSampleLibrary(BASE);
  // ルート直下（作品フォルダー外）に「秘密ファイル」を置き、トラバーサルの検証に使う
  writeFileSync(join(lib.root, "secret.txt"), "library-secret");
  const adapter = createRealAdapter({ dbPath: ":memory:" });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();

  const res = await app.request("/api/works");
  const works = (await res.json()) as WorksPage;
  const generated = works.items.find((w) => w.title.includes("RJ900001"))!;
  const existing = works.items.find((w) => w.title === "既存メタの作品")!;
  return { app, generated, existing };
}

test("音声配信: 200 全体取得と Range 206", async () => {
  const { app, generated } = await setup();

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

test("パストラバーサル: ../ を含む相対パスは 404", async () => {
  const { app, generated } = await setup();
  for (const rel of [
    "..%2Fsecret.txt",
    "..%2F..%2F..%2Fetc%2Fpasswd",
    "mp3%2F..%2F..%2Fsecret.txt",
  ]) {
    const res = await app.request(`/api/media/file/${generated.id}/${rel}`);
    assert.equal(res.status, 404, `should block: ${rel}`);
  }
});

test("カバー画像: coverImage あり 200 / なし 404 / 作品なし 404", async () => {
  const { app, generated, existing } = await setup();

  const ok = await app.request(`/api/media/cover/${generated.id}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/jpeg");

  assert.equal((await app.request(`/api/media/cover/${existing.id}`)).status, 404);
  assert.equal((await app.request("/api/media/cover/no-such-work")).status, 404);
});
