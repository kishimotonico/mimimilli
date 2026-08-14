// 実Bun.serve経由のaudio Range応答を検証する。
// fixture adapterはsynthetic経路のみ。realの実ファイルstream×Rangeはこのスモークの範囲外。
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { DataAdapter, MediaLocation } from "../../src/adapter/index.ts";
import { createFixtureAdapter } from "../../src/adapters/fixture/index.ts";
import { serveFixtureTransport } from "./helpers.ts";

const CHUNK_SIZE_BYTES = 8 * 1024 * 1024;
const OVERSIZED_AUDIO_BYTES = CHUNK_SIZE_BYTES + 1024;

function oversizedAudioAdapter(): DataAdapter {
  const fixture = createFixtureAdapter();
  const location: MediaLocation = {
    type: "synthetic",
    mime: "audio/wav",
    size: OVERSIZED_AUDIO_BYTES,
    read(start: number, end: number): Uint8Array {
      const length = Math.max(0, end - start + 1);
      return new Uint8Array(length).fill(128);
    },
  };
  return {
    ...fixture,
    async locateMedia(kind, workId, path) {
      if (kind === "audio" && workId === "RJ501001" && path === "track01.mp3") return location;
      return fixture.locateMedia(kind, workId, path);
    },
  };
}

test("audio Range: 閉区間bytes=0-1023で206と指定範囲のボディが返る", async (t: TestContext) => {
  const { server, baseUrl } = serveFixtureTransport();
  t.after(() => server.stop(true));

  const whole = await fetch(`${baseUrl}/api/media/audio/RJ501001/track01.mp3`);
  assert.equal(whole.status, 200);
  const totalSize = Number(whole.headers.get("content-length"));

  const response = await fetch(`${baseUrl}/api/media/audio/RJ501001/track01.mp3`, {
    headers: { Range: "bytes=0-1023" },
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), `bytes 0-1023/${totalSize}`);
  assert.equal(response.headers.get("content-length"), "1024");

  const body = new Uint8Array(await response.arrayBuffer());
  assert.equal(body.length, 1024);
  assert.equal(new TextDecoder("ascii").decode(body.subarray(0, 4)), "RIFF");
});

test("audio Range: 開放端bytes=0-は8MiB上限で打ち切った206を返す", async (t: TestContext) => {
  const { server, baseUrl } = serveFixtureTransport(oversizedAudioAdapter());
  t.after(() => server.stop(true));

  const response = await fetch(`${baseUrl}/api/media/audio/RJ501001/track01.mp3`, {
    headers: { Range: "bytes=0-" },
  });
  assert.equal(response.status, 206);
  assert.equal(
    response.headers.get("content-range"),
    `bytes 0-${CHUNK_SIZE_BYTES - 1}/${OVERSIZED_AUDIO_BYTES}`,
  );
  assert.equal(response.headers.get("content-length"), String(CHUNK_SIZE_BYTES));
  assert.equal((await response.arrayBuffer()).byteLength, CHUNK_SIZE_BYTES);
});
