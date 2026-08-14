// メディア配信中、Bun.serveのidleTimeoutで接続が誤切断されないことの結合テスト。
// named pipe（FIFO）への書き込み間隔で、配信中の無通信状態を再現する。
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { test, type TestContext } from "node:test";
import type { DataAdapter } from "../../src/adapter/index.ts";
import { mediaRoute } from "../../src/routes/media.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

const IDLE_TIMEOUT_SECONDS = 2;
const STALL_MS = (IDLE_TIMEOUT_SECONDS + 2) * 1000;
const FIRST_CHUNK = Buffer.alloc(1024, 1);
const SECOND_CHUNK = Buffer.alloc(4096, 2);
const TOTAL_BYTES = FIRST_CHUNK.length + SECOND_CHUNK.length;

function fifoAdapter(fifoPath: string): DataAdapter {
  return {
    async locateMedia() {
      return {
        type: "file",
        absolutePath: fifoPath,
        mime: "application/octet-stream",
        size: TOTAL_BYTES,
      };
    },
    async describeCover() {
      return null;
    },
    async locateWorkspaceMedia() {
      return null;
    },
  } as unknown as DataAdapter;
}

test("音声配信: 配信中に無通信期間が続いても切断されず全量受信できる（defer再現）", async (t: TestContext) => {
  const dir = makeTestDirectory("media-idle-timeout");
  t.after(dir.cleanup);
  const fifoPath = join(dir.path, "stream.fifo");
  execFileSync("mkfifo", [fifoPath]);

  const app = mediaRoute(fifoAdapter(fifoPath));
  const server = Bun.serve({
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: IDLE_TIMEOUT_SECONDS,
  });
  t.after(() => server.stop(true));

  const responsePromise = fetch(`http://127.0.0.1:${server.port}/media/file/w/track.bin`);

  const writer = createWriteStream(fifoPath);
  await new Promise<void>((resolve, reject) => {
    writer.on("open", () => resolve());
    writer.on("error", reject);
  });
  writer.write(FIRST_CHUNK);

  // Chromeのdeferを模して、idleTimeoutを超える時間まったく書き込まない。
  await sleep(STALL_MS);

  writer.end(SECOND_CHUNK);

  const response = await responsePromise;
  assert.equal(response.status, 200);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(bytes.length, TOTAL_BYTES, "無通信期間の後も残りバイトを全量受信できること");
});
