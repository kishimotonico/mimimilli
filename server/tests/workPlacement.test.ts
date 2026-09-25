import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveWorkPlacement, workPlacementOf, type MetaFile } from "@mimimilli/shared";

type PlaylistsMeta = Pick<MetaFile, "playlists" | "defaultPlaylistId">;

const DEFAULT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function track(file: string, index = 0, range: { start?: number; end?: number } = {}) {
  return {
    id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index).padStart(12, "0")}`,
    title: "t",
    file,
    ...range,
  };
}

function meta(files: string[], extra: PlaylistsMeta["playlists"] = []): PlaylistsMeta {
  return {
    playlists: [
      { id: DEFAULT_ID, name: "default", tracks: files.map((file, i) => track(file, i)) },
      ...extra,
    ],
    defaultPlaylistId: DEFAULT_ID,
  };
}

function mismatchMessage(meta: PlaylistsMeta, metaPath = "/lib/d00001.mimimilli.json"): string {
  const resolution = resolveWorkPlacement(metaPath, meta);
  assert.equal(resolution.ok, false);
  assert.equal(resolution.physicalPath, metaPath);
  return resolution.ok ? "" : resolution.message;
}

test("workPlacementOf: メタファイル名で形式を決め、mediaRootはmetaPathの親", () => {
  assert.deepEqual(workPlacementOf("/lib/foo.mp3/mimimilli.json"), {
    kind: "folder",
    metaPath: "/lib/foo.mp3/mimimilli.json",
    mediaRoot: "/lib/foo.mp3",
  });
  assert.deepEqual(workPlacementOf("C:\\lib\\d00001.mimimilli.json"), {
    kind: "audio-file",
    metaPath: "C:\\lib\\d00001.mimimilli.json",
    mediaRoot: "C:\\lib",
  });
  assert.throws(() => workPlacementOf("/lib/d00001.mp3"));
});

test("workPlacementOf: ルート直下のmediaRootは末尾の区切りを残す", () => {
  assert.equal(workPlacementOf("/mimimilli.json").mediaRoot, "/");
  assert.equal(workPlacementOf("C:\\mimimilli.json").mediaRoot, "C:\\");
  assert.equal(
    resolveWorkPlacement("C:\\d00001.mimimilli.json", meta(["d00001.mp3"])).physicalPath,
    "C:\\d00001.mp3",
  );
});

test("resolveWorkPlacement: フォルダー形式はmediaRootがphysicalPath", () => {
  const resolution = resolveWorkPlacement("/lib/work/mimimilli.json", meta(["a.mp3", "b.mp3"]));
  assert.equal(resolution.ok, true);
  assert.equal(resolution.physicalPath, "/lib/work");
  assert.equal(resolution.placement.kind, "folder");
});

test("resolveWorkPlacement: 単一ファイル形式は音声ファイルをmetaPathと同じ区切りでつなぐ", () => {
  const sameFileChapters = [
    { id: OTHER_ID, name: "chapters", tracks: [track("d00001.mp3", 1, { start: 0, end: 60 })] },
  ];
  const posix = resolveWorkPlacement(
    "/lib/d00001.mimimilli.json",
    meta(["d00001.mp3"], sameFileChapters),
  );
  assert.equal(posix.ok, true);
  assert.equal(posix.physicalPath, "/lib/d00001.mp3");
  assert.equal(posix.placement.kind, "audio-file");

  const windows = resolveWorkPlacement("C:\\lib\\d00001.mimimilli.json", meta(["d00001.mp3"]));
  assert.equal(windows.physicalPath, "C:\\lib\\d00001.mp3");
});

test("resolveWorkPlacement: 既定プレイリストのトラックが1つでなければ不整合", () => {
  assert.equal(
    mismatchMessage(meta(["d00001.mp3", "d00001.mp3"])),
    "配置形式が不整合です: d00001.mimimilli.json の既定プレイリストにはトラックが1つだけ必要です（2件あります）",
  );
  assert.match(mismatchMessage(meta([])), /（0件あります）$/);
  assert.match(mismatchMessage({ playlists: [], defaultPlaylistId: null }), /（0件あります）$/);
});

test("resolveWorkPlacement: トラックのfileがメタファイル名と完全に対応しなければ不整合", () => {
  assert.equal(
    mismatchMessage(meta(["d00002.mp3"])),
    "配置形式が不整合です: d00001.mimimilli.json のトラックが参照する d00002.mp3 は、このメタファイルに対応する音声ファイルではありません",
  );
  for (const file of ["sub/d00001.mp3", "sub\\d00001.mp3", "d00001", "d00001.txt", "D00001.mp3"]) {
    assert.match(
      mismatchMessage(meta([file])),
      /このメタファイルに対応する音声ファイルではありません$/,
      file,
    );
  }
});

test("resolveWorkPlacement: 既定以外のプレイリストが別のファイルを指せば不整合", () => {
  const extra = [{ id: OTHER_ID, name: "bonus", tracks: [track("bonus.mp3", 1)] }];
  assert.equal(
    mismatchMessage(meta(["d00001.mp3"], extra)),
    "配置形式が不整合です: d00001.mimimilli.json のプレイリスト「bonus」が d00001.mp3 以外のファイル（bonus.mp3）を参照しています",
  );
});
