// fixture アダプタのメディア合成（カバーSVG・無音WAV・Range配信）のテスト。
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";

function buildApp() {
  return createApp(createFixtureAdapter());
}

test("カバー画像: coverImage ありの作品は 200 + image/svg+xml", async () => {
  const app = buildApp();

  // RJ501001 は coverImage: "cover.jpg" を持つ
  const res = await app.request("/api/media/cover/RJ501001");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/svg+xml");

  const svg = await res.text();
  assert.match(svg, /<svg/);
});

test("カバー画像: coverImage なしの作品は 404", async () => {
  const app = buildApp();

  // RJ501003 は coverImage: null
  const res = await app.request("/api/media/cover/RJ501003");
  assert.equal(res.status, 404);
});

test("カバー画像: 存在しない作品は 404", async () => {
  const app = buildApp();
  const res = await app.request("/api/media/cover/NO_SUCH_WORK");
  assert.equal(res.status, 404);
});

test("音声配信: 200 で全長を返し、WAVヘッダーの宣言サイズと一致する", async () => {
  const app = buildApp();

  // RJ501001: totalDurationSec=5400, trackCount=6 → 1トラック900秒 → data=900*8000=7,200,000B
  const res = await app.request("/api/media/audio/RJ501001/track01.mp3");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "audio/wav");
  assert.equal(res.headers.get("accept-ranges"), "bytes");

  const expectedDataSize = 900 * 8000;
  const expectedTotalSize = 44 + expectedDataSize;
  assert.equal(res.headers.get("content-length"), String(expectedTotalSize));

  const buf = new Uint8Array(await res.arrayBuffer());
  assert.equal(buf.length, expectedTotalSize);

  // RIFF ヘッダーの宣言サイズ（オフセット4, リトルエンディアン）= 全体 - 8
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  assert.equal(view.getUint32(4, true), expectedTotalSize - 8);
  // data チャンクサイズ（オフセット40）
  assert.equal(view.getUint32(40, true), expectedDataSize);

  // RIFF/WAVE/fmt /data の各マジックバイト
  const text = new TextDecoder("ascii").decode(buf.subarray(0, 4));
  assert.equal(text, "RIFF");
  assert.equal(new TextDecoder("ascii").decode(buf.subarray(8, 12)), "WAVE");
  assert.equal(new TextDecoder("ascii").decode(buf.subarray(12, 16)), "fmt ");
  assert.equal(new TextDecoder("ascii").decode(buf.subarray(36, 40)), "data");
});

test("音声配信: Range: bytes=0-1023 で 206 + Content-Range（ヘッダー部を含む）", async () => {
  const app = buildApp();

  const whole = await app.request("/api/media/audio/RJ501001/track01.mp3");
  const totalSize = Number(whole.headers.get("content-length"));

  const res = await app.request("/api/media/audio/RJ501001/track01.mp3", {
    headers: { Range: "bytes=0-1023" },
  });
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("content-range"), `bytes 0-1023/${totalSize}`);
  assert.equal(res.headers.get("content-length"), "1024");

  const buf = new Uint8Array(await res.arrayBuffer());
  assert.equal(buf.length, 1024);
  // 先頭44バイトはWAVヘッダー（RIFF magic）
  assert.equal(new TextDecoder("ascii").decode(buf.subarray(0, 4)), "RIFF");
  // ヘッダー以降は無音データ（8bit PCM 無音 = 128）
  assert.equal(buf[44], 128);
  assert.equal(buf[1023], 128);
});

test("音声配信: 途中からの Range（ヘッダー部を含まない）も正しく無音データを返す", async () => {
  const app = buildApp();

  const whole = await app.request("/api/media/audio/RJ501001/track01.mp3");
  const totalSize = Number(whole.headers.get("content-length"));

  const start = 100000;
  const end = 100099;
  const res = await app.request("/api/media/audio/RJ501001/track01.mp3", {
    headers: { Range: `bytes=${start}-${end}` },
  });
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("content-range"), `bytes ${start}-${end}/${totalSize}`);
  assert.equal(res.headers.get("content-length"), "100");

  const buf = new Uint8Array(await res.arrayBuffer());
  assert.equal(buf.length, 100);
  assert.ok(buf.every((b) => b === 128));
});

test("音声配信: 存在しないトラックパスは 404", async () => {
  const app = buildApp();
  const res = await app.request("/api/media/audio/RJ501001/track99.mp3");
  assert.equal(res.status, 404);
});

test("音声配信: トラックを持たない作品は 404", async () => {
  const app = buildApp();
  // RJ501009 は trackCount: 0
  const res = await app.request("/api/media/audio/RJ501009/track01.mp3");
  assert.equal(res.status, 404);
});

test("ファイル配信: 特典フォルダー配下の画像は SVG プレースホルダー、テキストは固定文言", async () => {
  const app = buildApp();

  const pdf = await app.request("/api/media/file/RJ501001/特典/台本.pdf");
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "text/plain; charset=utf-8");

  const txt = await app.request("/api/media/file/RJ501001/特典/あとがき.txt");
  assert.equal(txt.status, 200);
  assert.equal(txt.headers.get("content-type"), "text/plain; charset=utf-8");

  const cover = await app.request("/api/media/file/RJ501001/cover.jpg");
  assert.equal(cover.status, 200);
  assert.equal(cover.headers.get("content-type"), "image/svg+xml");
});

test("ファイル配信: 存在しないパスは 404", async () => {
  const app = buildApp();
  const res = await app.request("/api/media/file/RJ501001/no-such-file.txt");
  assert.equal(res.status, 404);
});
