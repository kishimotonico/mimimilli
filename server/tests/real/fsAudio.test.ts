// Workspace media（GET /api/media/workspace）の結合テスト。
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { createApp } from "../../src/app.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

async function setup(t: TestContext) {
  const directory = makeTestDirectory("workspace-media");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const unregisteredDir = join(root, "unregistered");
  const audioPath = join(unregisteredDir, "sample.wav");
  mkdirSync(unregisteredDir, { recursive: true });
  writeWav(audioPath, 2);
  writeFileSync(join(root, "secret.wav"), Buffer.alloc(100));
  writeFileSync(join(root, "readme.txt"), "not audio");
  writeFileSync(join(root, "image.png"), Buffer.alloc(8));
  writeFileSync(join(root, "document.pdf"), Buffer.alloc(8));
  writeFileSync(join(root, "movie.mp4"), Buffer.alloc(8));
  writeFileSync(join(root, "large.txt"), Buffer.alloc(1024 * 1024 + 1, "a"));
  writeFileSync(join(root, "large.png"), Buffer.alloc(64 * 1024 * 1024 + 1));
  writeFileSync(join(root, "large.pdf"), Buffer.alloc(256 * 1024 * 1024 + 1));

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  return { app, root, audioPath, secretPath: join(root, "secret.wav") };
}

test("workspace media: 200 全体取得と Range 206", async (t) => {
  const { app } = await setup(t);
  const query = "?path=unregistered%2Fsample.wav";

  const whole = await app.request(`/api/media/workspace${query}`);
  assert.equal(whole.status, 200);
  assert.equal(whole.headers.get("content-type"), "audio/wav");
  assert.equal(whole.headers.get("accept-ranges"), "bytes");

  const part = await app.request(`/api/media/workspace${query}`, {
    headers: { Range: "bytes=44-143" },
  });
  assert.equal(part.status, 206);
  assert.match(part.headers.get("content-range") ?? "", /^bytes 44-143\/\d+$/);
  assert.equal((await part.arrayBuffer()).byteLength, 100);
});

test("workspace media: root外の絶対パスは 400", async (t) => {
  const { app } = await setup(t);
  const res = await app.request(`/api/media/workspace?path=${encodeURIComponent("/outside.wav")}`);
  assert.equal(res.status, 400);
});

test("workspace media: パストラバーサルは 400", async (t) => {
  const { app } = await setup(t);
  const res = await app.request(`/api/media/workspace?path=unregistered%2F..%2Fsecret.wav`);
  assert.equal(res.status, 400);
});

test("workspace media: textは配信できる", async (t) => {
  const { app } = await setup(t);
  const res = await app.request(`/api/media/workspace?path=readme.txt`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8");
});

test("workspace media: image/PDF/videoのMIMEとRangeをserverが判定する", async (t) => {
  const { app } = await setup(t);
  for (const [path, mime] of [
    ["image.png", "image/png"],
    ["document.pdf", "application/pdf"],
    ["movie.mp4", "video/mp4"],
  ]) {
    const res = await app.request(`/api/media/workspace?path=${path}`, {
      headers: { Range: "bytes=0-3" },
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-type"), mime);
    assert.equal((await res.arrayBuffer()).byteLength, 4);
  }
});

test("workspace media: 不正Rangeは416、textは1MiBで切り詰める", async (t) => {
  const { app } = await setup(t);
  const invalid = await app.request("/api/media/workspace?path=unregistered%2Fsample.wav", {
    headers: { Range: "bytes=999999999-" },
  });
  assert.equal(invalid.status, 416);
  const text = await app.request("/api/media/workspace?path=large.txt");
  assert.equal(text.status, 200);
  assert.equal(text.headers.get("content-length"), String(1024 * 1024));
  assert.equal((await text.arrayBuffer()).byteLength, 1024 * 1024);
});

test("workspace media: image/PDFの上限超過は拒否する", async (t) => {
  const { app } = await setup(t);
  assert.equal((await app.request("/api/media/workspace?path=large.png")).status, 404);
  assert.equal((await app.request("/api/media/workspace?path=large.pdf")).status, 404);
});
