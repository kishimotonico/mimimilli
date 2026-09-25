// 配置形式の不整合（ADR-0032）: scan の境界で作品が error になり、文言が real/fixture で一致する。
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { emptyMetaDlsiteState, META_FILE_NAME, type MetaFile } from "@mimimilli/shared";
import type { DataAdapter } from "../src/adapter/index.ts";
import { createFixtureAdapter, type FixtureSeedWork } from "../src/adapters/fixture/index.ts";
import { writeMetaFile } from "../src/adapters/real/meta.ts";
import { configureRoot } from "./helpers/rootFolder.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { makeTestDirectory, writeWav } from "./helpers/sampleLibrary.ts";

interface PlacementCase {
  stem: string;
  playlists: Array<{ name: string; files: string[] }>;
  expected: string;
}

const PREFIX = "配置形式が不整合です: ";

/** メタの中身だけで決まる不整合。real と fixture の両方で検出する */
const META_CASES: PlacementCase[] = [
  {
    stem: "two-tracks",
    playlists: [{ name: "default", files: ["two-tracks.wav", "two-tracks.wav"] }],
    expected: `${PREFIX}two-tracks.mimimilli.json の既定プレイリストにはトラックが1つだけ必要です（2件あります）`,
  },
  {
    stem: "renamed",
    playlists: [{ name: "default", files: ["other.wav"] }],
    expected: `${PREFIX}renamed.mimimilli.json のトラックが参照する other.wav は、このメタファイルに対応する音声ファイルではありません`,
  },
  {
    stem: "bonus",
    playlists: [
      { name: "default", files: ["bonus.wav"] },
      { name: "extra", files: ["extra.wav"] },
    ],
    expected: `${PREFIX}bonus.mimimilli.json のプレイリスト「extra」が bonus.wav 以外のファイル（extra.wav）を参照しています`,
  },
];

function workIdOf(stem: string): string {
  const hex = Buffer.from(stem).toString("hex").padEnd(12, "0").slice(0, 12);
  return `00000000-0000-4000-8000-${hex}`;
}

function metaOf(stem: string, playlists: PlacementCase["playlists"]): MetaFile {
  const built = playlists.map((playlist) => ({
    id: crypto.randomUUID(),
    name: playlist.name,
    tracks: playlist.files.map((file) => ({ id: crypto.randomUUID(), title: file, file })),
  }));
  return {
    formatVersion: 1,
    id: workIdOf(stem),
    title: stem,
    urls: [],
    tags: [],
    coverImage: null,
    playlists: built,
    defaultPlaylistId: built[0]?.id ?? null,
    dlsite: emptyMetaDlsiteState(),
  };
}

async function assertPlacementErrors(
  adapter: DataAdapter,
  cases: Array<Pick<PlacementCase, "stem" | "expected">>,
  label: string,
): Promise<void> {
  await adapter.scan();
  for (const { stem, expected } of cases) {
    const work = await adapter.getWork(workIdOf(stem));
    assert.ok(work, `${label}: ${stem}`);
    assert.equal(work.status, "error", `${label}: ${stem}`);
    assert.equal(work.errorMessage, expected, `${label}: ${stem}`);
  }
}

test("配置形式の不整合はscanでerrorになり、文言がreal/fixtureで一致する（real）", async (t) => {
  const directory = makeTestDirectory("work-placement-contract");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  mkdirSync(root, { recursive: true });
  for (const { stem, playlists } of META_CASES) {
    for (const file of new Set(playlists.flatMap((playlist) => playlist.files))) {
      writeWav(join(root, file), 1);
    }
    writeWav(join(root, `${stem}.wav`), 1);
    writeMetaFile(join(root, `${stem}.mimimilli.json`), metaOf(stem, playlists));
  }
  mkdirSync(join(root, "directory.wav"));
  writeMetaFile(
    join(root, "directory.mimimilli.json"),
    metaOf("directory", [{ name: "default", files: ["directory.wav"] }]),
  );
  writeMetaFile(
    join(root, "absent.mimimilli.json"),
    metaOf("absent", [{ name: "default", files: ["absent.wav"] }]),
  );

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await assertPlacementErrors(
    adapter,
    [
      ...META_CASES,
      {
        stem: "directory",
        expected: `${PREFIX}directory.mimimilli.json が指す directory.wav はファイルとして存在しません`,
      },
      {
        stem: "absent",
        expected: `${PREFIX}absent.mimimilli.json が指す absent.wav はファイルとして存在しません`,
      },
    ],
    "real",
  );
  const broken = await adapter.getWork(workIdOf("two-tracks"));
  assert.equal(broken?.physicalPath, join(root, "two-tracks.mimimilli.json"));
});

test("配置形式の不整合はscanでerrorになり、文言がreal/fixtureで一致する（fixture）", async () => {
  const works: FixtureSeedWork[] = META_CASES.map(({ stem }) => ({
    id: workIdOf(stem),
    title: stem,
    cover: null,
    status: "ok",
    physicalPath: `/library/${stem}.wav`,
    metaPath: `/library/${stem}.mimimilli.json`,
    totalDurationSec: 1,
    addedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: { ...emptyMetaDlsiteState(), lastAttemptAt: null, error: null, errorKind: null },
  }));
  const adapter = createFixtureAdapter({
    works,
    playlistSpecs: Object.fromEntries(
      META_CASES.map(({ stem, playlists }) => [
        workIdOf(stem),
        playlists.map((playlist) => ({
          name: playlist.name,
          tracks: playlist.files.map((file) => ({ title: file, file, durationSec: 1 })),
        })),
      ]),
    ),
  });
  await assertPlacementErrors(adapter, META_CASES, "fixture");
  const broken = await adapter.getWork(workIdOf("two-tracks"));
  assert.equal(broken?.physicalPath, "/library/two-tracks.mimimilli.json");
});

test("単一ファイル形式のメタが壊れると、既存の作品がerrorになる（real）", async (t) => {
  const directory = makeTestDirectory("work-placement-broken-meta");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  mkdirSync(root, { recursive: true });
  writeWav(join(root, "single.wav"), 1);
  const metaPath = join(root, "single.mimimilli.json");
  writeMetaFile(metaPath, metaOf("single", [{ name: "default", files: ["single.wav"] }]));

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan();
  const before = await adapter.getWork(workIdOf("single"));
  assert.equal(before?.status, "ok");
  assert.equal(before?.physicalPath, join(root, "single.wav"));

  writeFileSync(metaPath, "{ broken");
  await adapter.scan();
  const after = await adapter.getWork(workIdOf("single"));
  assert.equal(after?.status, "error");
  assert.equal(after?.physicalPath, metaPath);
});

test("音声拡張子で終わる名前のフォルダーはフォルダー作品としてトラックを解決する（real）", async (t) => {
  const directory = makeTestDirectory("work-placement-audio-named-folder");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const folder = join(root, "album.mp3");
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "track.wav"), 2);
  const meta = metaOf("album", [{ name: "default", files: ["track.wav"] }]);
  writeMetaFile(join(folder, META_FILE_NAME), meta);

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan();
  const work = await adapter.getWork(meta.id);
  assert.equal(work?.status, "ok");
  assert.equal(work?.physicalPath, folder);
  assert.equal(work?.playlists[0]?.tracks[0]?.durationKind, "resolved");
});
