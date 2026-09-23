// POST /api/works/:id/resume と PATCH /api/works/:id の HTTP 結合テスト（real adapter + createApp.request）
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { Work } from "@mimimilli/shared";
import { createApp, type App } from "../../src/app.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { pollUntil } from "../helpers/poll.ts";
import { makeSampleLibrary } from "../helpers/sampleLibrary.ts";
import { nts } from "../helpers/tag.ts";

const EXISTING_PLAYLIST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EXISTING_TRACK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

async function setup(t: TestContext): Promise<{
  app: App;
  existingWorkId: string;
  metaPath: string;
}> {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const metaPath = join(lib.root, "dlsite", "RJ900002_既存メタ", "mimimilli.json");
  const raw = JSON.parse(readFileSync(metaPath, "utf-8"));
  raw.myNote = "ユーザーの手書きメモ";
  writeFileSync(metaPath, JSON.stringify(raw, null, 2));

  const adapter = lib.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = lib.ownFn(createApp(adapter), (instance) => instance.shutdown());
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  return {
    app,
    existingWorkId: lib.existingWorkId,
    metaPath,
  };
}

function jsonRequest(
  app: App,
  path: string,
  init: { method?: string; body?: unknown },
): Promise<Response> {
  return Promise.resolve(
    app.request(path, {
      method: init.method,
      headers: { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}

test("POST /api/works/:id/resume は正当な resume で 204 を返し GET で永続化を確認する", async (t) => {
  const { app, existingWorkId } = await setup(t);
  const resume = {
    playlistId: EXISTING_PLAYLIST_ID,
    trackId: EXISTING_TRACK_ID,
    offsetSec: 0.5,
  };

  const post = await jsonRequest(app, `/api/works/${existingWorkId}/resume`, {
    method: "POST",
    body: resume,
  });
  assert.equal(post.status, 204);

  await pollUntil(async () => {
    const res = await app.request(`/api/works/${existingWorkId}`);
    if (res.status !== 200) return false;
    const work = (await res.json()) as Work;
    return (
      work.resume?.playlistId === resume.playlistId &&
      work.resume.trackId === resume.trackId &&
      work.resume.offsetSec === resume.offsetSec
    );
  });
});

test("POST /api/works/:id/resume は不正ボディを 400 invalid_request で拒否する", async (t) => {
  const { app, existingWorkId } = await setup(t);

  const schemaInvalid = await jsonRequest(app, `/api/works/${existingWorkId}/resume`, {
    method: "POST",
    body: { playlistId: "not-a-uuid", trackId: EXISTING_TRACK_ID, offsetSec: 0 },
  });
  assert.equal(schemaInvalid.status, 400);
  assert.equal((await schemaInvalid.json()).error.code, "invalid_request");

  const domainInvalid = await jsonRequest(app, `/api/works/${existingWorkId}/resume`, {
    method: "POST",
    body: {
      playlistId: crypto.randomUUID(),
      trackId: EXISTING_TRACK_ID,
      offsetSec: 0,
    },
  });
  assert.equal(domainInvalid.status, 400);
  assert.equal((await domainInvalid.json()).error.code, "invalid_request");
});

test("POST /api/works/:id/resume は存在しない作品を 404 で返す", async (t) => {
  const { app } = await setup(t);
  const missingId = "00000000-0000-4000-8000-000000000099";

  const res = await jsonRequest(app, `/api/works/${missingId}/resume`, {
    method: "POST",
    body: {
      playlistId: EXISTING_PLAYLIST_ID,
      trackId: EXISTING_TRACK_ID,
      offsetSec: 0,
    },
  });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, "not_found");
});

test("PATCH /api/works/:id は title/tags を mimimilli.json へ書き戻す", async (t) => {
  const { app, existingWorkId, metaPath } = await setup(t);

  const sourceRes = await app.request(`/api/works/${existingWorkId}/source`);
  assert.equal(sourceRes.status, 200);
  const source = (await sourceRes.json()) as { sourceRevision: string };

  const patchRes = await jsonRequest(app, `/api/works/${existingWorkId}`, {
    method: "PATCH",
    body: {
      title: "改題された作品",
      tags: nts(["cv/水瀬なずな", "新タグ"]),
      sourceRevision: source.sourceRevision,
    },
  });
  assert.equal(patchRes.status, 200);
  const patched = (await patchRes.json()) as { snapshot: { title: string } };
  assert.equal(patched.snapshot.title, "改題された作品");

  await pollUntil(() => {
    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    return meta.title === "改題された作品" && meta.tags?.[1] === "新タグ";
  });

  const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
  assert.equal(meta.title, "改題された作品");
  assert.deepEqual(meta.tags, ["cv/水瀬なずな", "新タグ"]);
  assert.equal(meta.myNote, "ユーザーの手書きメモ");
  assert.equal(meta.id, existingWorkId);
});
