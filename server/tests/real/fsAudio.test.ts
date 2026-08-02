// ファイルモード用音声配信（GET /api/media/fs-audio）の結合テスト。
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { createApp } from "../../src/app.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

async function setup(t: TestContext) {
  const directory = makeTestDirectory("fs-audio");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const unregisteredDir = join(root, "unregistered");
  const audioPath = join(unregisteredDir, "sample.wav");
  mkdirSync(unregisteredDir, { recursive: true });
  writeWav(audioPath, 2);
  writeFileSync(join(root, "secret.wav"), Buffer.alloc(100));
  writeFileSync(join(root, "readme.txt"), "not audio");

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  return { app, root, audioPath, secretPath: join(root, "secret.wav") };
}

test("fs-audio: 200 全体取得と Range 206", async (t) => {
  const { app, audioPath } = await setup(t);
  const query = `?path=${encodeURIComponent(audioPath)}`;

  const whole = await app.request(`/api/media/fs-audio${query}`);
  assert.equal(whole.status, 200);
  assert.equal(whole.headers.get("content-type"), "audio/wav");
  assert.equal(whole.headers.get("accept-ranges"), "bytes");

  const part = await app.request(`/api/media/fs-audio${query}`, {
    headers: { Range: "bytes=44-143" },
  });
  assert.equal(part.status, 206);
  assert.match(part.headers.get("content-range") ?? "", /^bytes 44-143\/\d+$/);
  assert.equal((await part.arrayBuffer()).byteLength, 100);
});

test("fs-audio: スキャンルート外のパスは 404", async (t) => {
  const { app, root } = await setup(t);
  const outside = join(root, "..", "outside.wav");
  writeFileSync(outside, Buffer.alloc(100));

  const res = await app.request(`/api/media/fs-audio?path=${encodeURIComponent(outside)}`);
  assert.equal(res.status, 404);
});

test("fs-audio: パストラバーサルは 404", async (t) => {
  const { app, root } = await setup(t);
  const outside = join(root, "..", "outside.wav");
  writeFileSync(outside, Buffer.alloc(100));
  const traversal = join(root, "unregistered", "..", "..", "..", "outside.wav");
  const res = await app.request(`/api/media/fs-audio?path=${encodeURIComponent(traversal)}`);
  assert.equal(res.status, 404);
});

test("fs-audio: 非音声ファイルは 404", async (t) => {
  const { app, root } = await setup(t);
  const textPath = join(root, "readme.txt");
  const res = await app.request(`/api/media/fs-audio?path=${encodeURIComponent(textPath)}`);
  assert.equal(res.status, 404);
});
