import assert from "node:assert/strict";
import { test } from "node:test";
import { workspacePath } from "@mimimilli/shared";
import { classifyWorkChanges, type WorkSnapshot } from "../../src/core/workChanges.ts";

const root = "/lib";
const base: WorkSnapshot = {
  status: "ok",
  metaPath: "/lib/a/work/mimimilli.json",
  physicalPath: "/lib/a/work",
  sourceRevision: "s1",
  mediaRevision: "m1",
  audioFileCount: 2,
};

test("変化なしなら空", () => {
  assert.deepEqual(classifyWorkChanges(base, { ...base }, root), []);
});

test("移動は旧パスと新パスをroot相対で持つ", () => {
  assert.deepEqual(
    classifyWorkChanges(
      base,
      { ...base, metaPath: "/lib/b/work/mimimilli.json", physicalPath: "/lib/b/work" },
      root,
    ),
    [{ kind: "moved", from: workspacePath("a/work"), to: workspacePath("b/work") }],
  );
});

test("作品情報ファイルの変更は meta", () => {
  assert.deepEqual(classifyWorkChanges(base, { ...base, sourceRevision: "s2" }, root), [
    { kind: "meta" },
  ]);
});

test("ファイル構成は音声の増減数を持つ", () => {
  assert.deepEqual(
    classifyWorkChanges(base, { ...base, mediaRevision: "m2", audioFileCount: 5 }, root),
    [{ kind: "files", audioDelta: 3 }],
  );
  assert.deepEqual(
    classifyWorkChanges(base, { ...base, mediaRevision: "m2", audioFileCount: 1 }, root),
    [{ kind: "files", audioDelta: -1 }],
  );
  assert.deepEqual(classifyWorkChanges(base, { ...base, mediaRevision: "m2" }, root), [
    { kind: "files", audioDelta: 0 },
  ]);
});

test("複数の種類は移動・作品情報・ファイル構成の順に並ぶ", () => {
  assert.deepEqual(
    classifyWorkChanges(
      base,
      {
        status: "ok",
        metaPath: "/lib/b/work/mimimilli.json",
        physicalPath: "/lib/b/work",
        sourceRevision: "s2",
        mediaRevision: "m2",
        audioFileCount: 3,
      },
      root,
    ),
    [
      { kind: "moved", from: workspacePath("a/work"), to: workspacePath("b/work") },
      { kind: "meta" },
      { kind: "files", audioDelta: 1 },
    ],
  );
});

test("revisionが未保存の記録は比較できないので変化にしない", () => {
  assert.deepEqual(
    classifyWorkChanges(
      { ...base, sourceRevision: null, mediaRevision: null },
      { ...base, sourceRevision: "s2", mediaRevision: "m2" },
      root,
    ),
    [],
  );
});

test("前回か今回がerrorの作品は、どの差があっても変化なし", () => {
  const changed = {
    metaPath: "/lib/b/work/mimimilli.json",
    physicalPath: "/lib/b/work",
    sourceRevision: "s2",
    mediaRevision: "m2",
    audioFileCount: 5,
  };
  assert.deepEqual(
    classifyWorkChanges({ ...base, status: "error" }, { ...base, ...changed }, root),
    [],
  );
  assert.deepEqual(classifyWorkChanges(base, { ...base, ...changed, status: "error" }, root), []);
});

test("physicalPathが未解決でもmetaPathが同じなら移動にしない", () => {
  assert.deepEqual(
    classifyWorkChanges(
      {
        ...base,
        status: "missing",
        physicalPath: "/lib/a/work/x.mimimilli.json",
        metaPath: "/lib/a/work/x.mimimilli.json",
      },
      { ...base, metaPath: "/lib/a/work/x.mimimilli.json", physicalPath: "/lib/a/work/x.wav" },
      root,
    ),
    [],
  );
});

test("前回がmissingの作品は変化を判定する", () => {
  assert.deepEqual(
    classifyWorkChanges(
      { ...base, status: "missing" },
      { ...base, metaPath: "/lib/b/work/mimimilli.json", physicalPath: "/lib/b/work" },
      root,
    ),
    [{ kind: "moved", from: workspacePath("a/work"), to: workspacePath("b/work") }],
  );
});
