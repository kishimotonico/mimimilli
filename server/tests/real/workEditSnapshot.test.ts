import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import {
  SOURCE_FILE_BROKEN_MESSAGE,
  SOURCE_FORMAT_UNSUPPORTED_MESSAGE,
  SOURCE_IDENTITY_MISMATCH_MESSAGE,
  SOURCE_LOCATION_MISMATCH_MESSAGE,
  SourceConflictError,
  SourceParseError,
} from "../../src/errors.ts";
import { createApp } from "../../src/app.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { makeSampleLibrary, makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";
import { nts } from "../helpers/tag.ts";
import { emptyDlsiteState } from "@mimimilli/shared";

async function setup(t: TestContext) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = lib.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  const app = createApp(adapter);
  return {
    ...lib,
    adapter,
    app,
    metaPath: join(lib.root, "dlsite", "RJ900002_既存メタ", "mimimilli.json"),
  };
}

test("GET /source は外部が足したタグを取り込み、GET /works は scan 前なら古いまま", async (t) => {
  const { adapter, existingWorkId, metaPath } = await setup(t);
  const raw = JSON.parse(readFileSync(metaPath, "utf-8"));
  raw.tags = [...raw.tags, "C"];
  writeFileSync(metaPath, JSON.stringify(raw, null, 2));

  const snapshot = await adapter.getWorkEditSnapshot(existingWorkId);
  assert.ok(snapshot);
  assert.ok((snapshot.tags as string[]).includes("C"));
  const view = await adapter.getWork(existingWorkId);
  assert.equal((view?.tags as string[] | undefined)?.includes("C"), false);
});

test("取得済み revision での配列置換は外部追加を保護して 409 になる", async (t) => {
  const { adapter, existingWorkId, metaPath } = await setup(t);
  const snapshot = await adapter.getWorkEditSnapshot(existingWorkId);
  assert.ok(snapshot);
  const raw = JSON.parse(readFileSync(metaPath, "utf-8"));
  raw.tags = [...raw.tags, "C"];
  writeFileSync(metaPath, JSON.stringify(raw, null, 2));

  await assert.rejects(
    adapter.patchWorkSource(existingWorkId, {
      sourceRevision: snapshot.sourceRevision,
      tags: nts(["A", "B", "D"]),
    }),
    (error: unknown) => error instanceof Error && error.name === "SourceChangedError",
  );
  assert.ok((JSON.parse(readFileSync(metaPath, "utf-8")).tags as string[]).includes("C"));
});

test("外部追加のあと snapshot を取り直して PATCH すると C も D も残る", async (t) => {
  const { adapter, existingWorkId, metaPath } = await setup(t);
  const raw = JSON.parse(readFileSync(metaPath, "utf-8"));
  raw.tags = [...raw.tags, "C"];
  writeFileSync(metaPath, JSON.stringify(raw, null, 2));
  const snapshot = await adapter.getWorkEditSnapshot(existingWorkId);
  assert.ok(snapshot);
  const result = await adapter.patchWorkSource(existingWorkId, {
    sourceRevision: snapshot.sourceRevision,
    tags: nts([...snapshot.tags, "D"]),
  });
  assert.ok(result);
  assert.ok((result.snapshot.tags as string[]).includes("C"));
  assert.ok((result.snapshot.tags as string[]).includes("D"));
});

test("外部がタグを足したあと意図コマンドで D を足すと C と D が残る", async (t) => {
  const { adapter, existingWorkId, metaPath } = await setup(t);
  const raw = JSON.parse(readFileSync(metaPath, "utf-8"));
  raw.tags = [...raw.tags, "C"];
  writeFileSync(metaPath, JSON.stringify(raw, null, 2));
  const result = await adapter.addWorkTag(existingWorkId, nts(["D"])[0]!);
  assert.ok(result);
  assert.ok((result.snapshot.tags as string[]).includes("C"));
  assert.ok((result.snapshot.tags as string[]).includes("D"));
});

test("identity 不一致は GET source も PATCH も conflict", async (t) => {
  const { adapter, app, existingWorkId, metaPath } = await setup(t);
  const raw = JSON.parse(readFileSync(metaPath, "utf-8"));
  raw.id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  writeFileSync(metaPath, JSON.stringify(raw, null, 2));

  await assert.rejects(adapter.getWorkEditSnapshot(existingWorkId), SourceConflictError);
  const sourceRes = await app.request(`/api/works/${existingWorkId}/source`);
  assert.equal(sourceRes.status, 409);
  assert.equal((await sourceRes.json()).error.message, SOURCE_IDENTITY_MISMATCH_MESSAGE);
  assert.equal(JSON.parse(readFileSync(metaPath, "utf-8")).id, raw.id);
});

test("location 不一致は GET source も PATCH も conflict", async (t) => {
  const dir = makeTestDirectory("source-location");
  t.after(dir.cleanup);
  const workDir = join(dir.path, "single");
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "foo.wav"), 1);
  const workId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const playlistId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const trackId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const metaPath = join(workDir, "foo.mimimilli.json");
  writeFileSync(
    metaPath,
    JSON.stringify(
      {
        formatVersion: 1,
        id: workId,
        title: "単一ファイル",
        tags: [],
        playlists: [
          {
            id: playlistId,
            name: "default",
            tracks: [{ id: trackId, title: "foo", file: "foo.wav" }],
          },
        ],
        defaultPlaylistId: playlistId,
        urls: [],
        dlsite: emptyDlsiteState(),
      },
      null,
      2,
    ),
  );
  const adapter = dir.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: dir.path });
  await adapter.scan();
  const raw = JSON.parse(readFileSync(metaPath, "utf-8"));
  raw.playlists[0].tracks[0].file = "other.wav";
  writeFileSync(metaPath, JSON.stringify(raw, null, 2));
  await assert.rejects(adapter.getWorkEditSnapshot(workId), (error: unknown) => {
    return (
      error instanceof SourceConflictError && error.message === SOURCE_LOCATION_MISMATCH_MESSAGE
    );
  });
});

test("正本が壊れていても GET /works は 200、GET /source は parse_error、bookmark は通る", async (t) => {
  const { adapter, app, existingWorkId, metaPath } = await setup(t);
  writeFileSync(metaPath, "{ not json");
  const viewRes = await app.request(`/api/works/${existingWorkId}`);
  assert.equal(viewRes.status, 200);
  assert.equal("sourceRevision" in (await viewRes.json()), false);
  const sourceRes = await app.request(`/api/works/${existingWorkId}/source`);
  assert.equal(sourceRes.status, 502);
  const body = await sourceRes.json();
  assert.equal(body.error.code, "parse_error");
  assert.equal(body.error.message, SOURCE_FILE_BROKEN_MESSAGE);
  const bookmark = await adapter.patchWorkBookmark(existingWorkId, { bookmarked: true });
  assert.equal(bookmark?.bookmarked, true);
  assert.equal(readFileSync(metaPath, "utf-8"), "{ not json");
});

test("ファイル欠損は conflict、formatVersion 非対応は parse_error", async (t) => {
  const { adapter, existingWorkId, metaPath } = await setup(t);
  const original = JSON.parse(readFileSync(metaPath, "utf-8"));
  const { unlinkSync } = await import("node:fs");
  unlinkSync(metaPath);
  await assert.rejects(adapter.getWorkEditSnapshot(existingWorkId), SourceConflictError);
  writeFileSync(metaPath, JSON.stringify({ ...original, formatVersion: 99 }, null, 2));
  await assert.rejects(
    adapter.getWorkEditSnapshot(existingWorkId),
    (error: unknown) =>
      error instanceof SourceParseError && error.message === SOURCE_FORMAT_UNSUPPORTED_MESSAGE,
  );
});

test("bookmark PATCH に sourceRevision は不要で mimimilli.json は変わらない", async (t) => {
  const { app, existingWorkId, metaPath } = await setup(t);
  const before = readFileSync(metaPath);
  const res = await app.request(`/api/works/${existingWorkId}/bookmark`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookmarked: true }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(Buffer.from(readFileSync(metaPath)).equals(before), true);
});

test("タグパスは正規化し、スラッシュ・パーセント・全角・NFC/NFD を往復できる", async (t) => {
  const { app, existingWorkId } = await setup(t);
  const cases = ["cv/foo", "100%", "全角タグ", "café".normalize("NFC"), "café".normalize("NFD")];
  for (const tag of cases) {
    const encoded = encodeURIComponent(tag);
    const putRes = await app.request(`/api/works/${existingWorkId}/tags/${encoded}`, {
      method: "PUT",
    });
    assert.equal(putRes.status, 200, tag);
    const putBody = await putRes.json();
    assert.ok(
      putBody.snapshot.tags.includes(tag),
      "PUT " + tag + " stored " + JSON.stringify(putBody.snapshot.tags),
    );
    const source = await (await app.request("/api/works/" + existingWorkId + "/source")).json();
    assert.ok(source.tags.includes(tag), "GET source missing " + tag);
    const delRes = await app.request("/api/works/" + existingWorkId + "/tags/" + encoded, {
      method: "DELETE",
    });
    assert.equal(delRes.status, 200, "DELETE " + tag);
    assert.equal((await delRes.json()).snapshot.tags.includes(tag), false);
  }
});
