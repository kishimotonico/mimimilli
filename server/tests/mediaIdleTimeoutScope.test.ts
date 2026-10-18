// media routeがidle timeoutを無効化するのは、正当なストリーミング応答が確定したときだけ。
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { DataAdapter } from "../src/adapter/index.ts";
import { mediaRoute } from "../src/routes/media.ts";
import { makeTestDirectory } from "./helpers/sampleLibrary.ts";

const BYTES = 1024;

function setup(t: TestContext) {
  const dir = makeTestDirectory("media-idle-timeout-scope");
  t.after(dir.cleanup);
  const audioPath = join(dir.path, "a.wav");
  writeFileSync(audioPath, Buffer.alloc(BYTES, 1));
  const timeoutCalls: number[] = [];
  const timeoutCallsAtMaterialize: number[] = [];
  const adapter = {
    async locateMedia(_kind: string, _id: string, path?: string) {
      return path === "a.wav" ? { type: "file", absolutePath: audioPath, mime: "audio/wav" } : null;
    },
    async describeCover(id: string) {
      if (id === "slow") {
        return {
          etag: 'W/"slow"',
          lastModifiedMs: 0,
          async materialize() {
            timeoutCallsAtMaterialize.push(timeoutCalls.length);
            return { type: "file", absolutePath: audioPath, mime: "audio/wav", size: BYTES };
          },
        };
      }
      return null;
    },
    async locateWorkspaceMedia() {
      return null;
    },
  } as unknown as DataAdapter;
  const app = mediaRoute(adapter);
  const env = {
    server: { timeout: (_req: Request, seconds: number) => timeoutCalls.push(seconds) },
  };
  const get = async (path: string, headers: Record<string, string> = {}) => {
    const res = await app.fetch(new Request(`http://localhost${path}`, { headers }), env);
    await res.arrayBuffer();
    return res;
  };
  return { get, timeoutCalls, timeoutCallsAtMaterialize };
}

test("正当なaudio配信（200・206）ではidle timeoutを無効化する", async (t) => {
  const { get, timeoutCalls } = setup(t);
  assert.equal((await get("/media/audio/w/a.wav")).status, 200);
  assert.deepEqual(timeoutCalls, [0]);
  assert.equal((await get("/media/audio/w/a.wav", { Range: "bytes=0-9" })).status, 206);
  assert.deepEqual(timeoutCalls, [0, 0]);
});

test("存在しないファイル（404）ではidle timeoutを無効化しない", async (t) => {
  const { get, timeoutCalls } = setup(t);
  assert.equal((await get("/media/audio/w/missing.wav")).status, 404);
  assert.deepEqual(timeoutCalls, []);
});

test("範囲外Range（416）ではidle timeoutを無効化しない", async (t) => {
  const { get, timeoutCalls } = setup(t);
  assert.equal((await get("/media/audio/w/a.wav", { Range: `bytes=${BYTES}-` })).status, 416);
  assert.deepEqual(timeoutCalls, []);
});

test("不正なクエリ（400）・カバー無し（404）・workspace不在（404）では無効化しない", async (t) => {
  const { get, timeoutCalls } = setup(t);
  assert.equal((await get("/media/cover/w?w=abc")).status, 400);
  assert.equal((await get("/media/cover/w")).status, 404);
  assert.equal((await get("/media/workspace?path=x.txt")).status, 404);
  assert.deepEqual(timeoutCalls, []);
});

test("カバー配信はmaterialize（サムネイル生成）の前にidle timeoutを無効化する", async (t) => {
  const { get, timeoutCalls, timeoutCallsAtMaterialize } = setup(t);
  assert.equal((await get("/media/cover/slow")).status, 200);
  assert.deepEqual(timeoutCallsAtMaterialize, [1]);
  assert.deepEqual(timeoutCalls, [0]);
});

test("カバーの304ではidle timeoutを無効化せずmaterializeもしない", async (t) => {
  const { get, timeoutCalls, timeoutCallsAtMaterialize } = setup(t);
  assert.equal((await get("/media/cover/slow", { "If-None-Match": 'W/"slow"' })).status, 304);
  assert.deepEqual(timeoutCalls, []);
  assert.deepEqual(timeoutCallsAtMaterialize, []);
});
