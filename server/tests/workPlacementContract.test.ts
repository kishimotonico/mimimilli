// 配置形式の不整合（ADR-0032）: scan の境界で作品が error になり、文言が real/fixture で一致する。
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { emptyMetaDlsiteState, META_FILE_NAME, type MetaFile } from "@mimimilli/shared";
import type { DataAdapter } from "../src/adapter/index.ts";
import { createFixtureAdapter, type FixtureSeedWork } from "../src/adapters/fixture/index.ts";
import { writeMetaFile } from "../src/adapters/real/meta.ts";
import { identityConflictMetaPath } from "../src/adapters/real/paths.ts";
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
    stem: "noext",
    playlists: [{ name: "default", files: ["noext"] }],
    expected: `${PREFIX}noext.mimimilli.json のトラックが参照する noext は、このメタファイルに対応する音声ファイルではありません`,
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

test("ルート直下の単一ファイル形式の作品は、scanで整合した配置として扱う（fixture）", async () => {
  const adapter = createFixtureAdapter({
    works: [
      {
        id: workIdOf("single"),
        title: "single",
        cover: null,
        status: "ok",
        physicalPath: "/single.wav",
        metaPath: "/single.mimimilli.json",
        totalDurationSec: 1,
        addedAt: "2026-01-01T00:00:00.000Z",
        errorMessage: null,
        urls: [],
        tags: [],
        trackCount: 1,
        bookmarked: false,
        lastPlayedAt: null,
        dlsite: { ...emptyMetaDlsiteState(), lastAttemptAt: null, error: null, errorKind: null },
      },
    ],
  });
  await adapter.scan();
  const work = await adapter.getWork(workIdOf("single"));
  assert.equal(work?.status, "ok");
  assert.equal(work?.errorMessage, null);
  assert.equal(work?.playlists[0]?.tracks[0]?.file, "single.wav");
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

test("単一ファイル形式の壊れたメタのコピーはメタファイルのパスでidentity_conflictになる（real）", async (t) => {
  const directory = makeTestDirectory("work-placement-identity-conflict");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const meta = metaOf("single", [{ name: "default", files: ["single.wav"] }]);
  for (const dir of ["a", "b"]) {
    mkdirSync(join(root, dir), { recursive: true });
    writeWav(join(root, dir, "single.wav"), 1);
  }
  writeMetaFile(join(root, "a", "single.mimimilli.json"), meta);

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan();
  writeFileSync(join(root, "b", "single.mimimilli.json"), `{ "id": "${meta.id}", broken`);
  const result = await adapter.scan();

  assert.deepEqual(result.identityConflicts, [
    {
      kind: "identity_conflict",
      workId: meta.id,
      paths: ["a/single.mimimilli.json", "b/single.mimimilli.json"],
    },
  ]);
  const owner = await adapter.getWork(meta.id);
  assert.equal(owner?.status, "ok");
  assert.equal(owner?.physicalPath, join(root, "a", "single.wav"));
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

async function registerSingleFileWork(
  name: string,
  dirs: string[],
): Promise<{ root: string; meta: MetaFile; adapter: DataAdapter; cleanup: () => void }> {
  const directory = makeTestDirectory(name);
  const root = join(directory.path, "library");
  const meta = metaOf("single", [{ name: "default", files: ["single.wav"] }]);
  for (const dir of dirs) {
    mkdirSync(join(root, dir), { recursive: true });
    writeWav(join(root, dir, "single.wav"), 1);
  }
  writeMetaFile(join(root, dirs[0]!, "single.mimimilli.json"), meta);
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan();
  return { root, meta, adapter, cleanup: directory.cleanup };
}

test("identity_conflictのパスからのメタファイル解決は名前だけで決まる", () => {
  assert.equal(
    identityConflictMetaPath("/nowhere/b/single.mimimilli.json"),
    "/nowhere/b/single.mimimilli.json",
  );
  assert.equal(identityConflictMetaPath("/nowhere/b/work"), `/nowhere/b/work/${META_FILE_NAME}`);
});

test("単一ファイル形式の重複は、メタファイルのパスで再採番できる（real）", async (t) => {
  const { root, meta, adapter, cleanup } = await registerSingleFileWork("work-placement-reassign", [
    "a",
    "b",
  ]);
  t.after(cleanup);
  const copyPath = join(root, "b", "single.mimimilli.json");
  writeMetaFile(copyPath, meta);
  await adapter.scan();

  const result = await adapter.reassignIdentityConflict({
    path: "b/single.mimimilli.json" as never,
  });
  assert.ok(result);
  const reassigned = JSON.parse(readFileSync(copyPath, "utf-8")) as { id: string };
  assert.notEqual(reassigned.id, meta.id);
  assert.deepEqual(await adapter.listScanDiagnostics(), []);
});

test("再採番の前にメタが消えていても、単一ファイル形式はフォルダーとして読まない（real）", async (t) => {
  const { root, meta, adapter, cleanup } = await registerSingleFileWork(
    "work-placement-reassign-missing",
    ["a", "b"],
  );
  t.after(cleanup);
  const copyPath = join(root, "b", "single.mimimilli.json");
  writeMetaFile(copyPath, meta);
  await adapter.scan();
  renameSync(copyPath, join(root, "b", "moved.json"));
  assert.equal(
    await adapter.reassignIdentityConflict({ path: "b/single.mimimilli.json" as never }),
    null,
  );

  mkdirSync(copyPath);
  writeMetaFile(join(copyPath, META_FILE_NAME), meta);
  await assert.rejects(() =>
    adapter.reassignIdentityConflict({ path: "b/single.mimimilli.json" as never }),
  );
  const untouched = JSON.parse(readFileSync(join(copyPath, META_FILE_NAME), "utf-8")) as {
    id: string;
  };
  assert.equal(untouched.id, meta.id);
});

test("壊れた単一ファイル形式のメタを直して反映すると、競合にならず投影される（real）", async (t) => {
  const { root, meta, adapter, cleanup } = await registerSingleFileWork(
    "work-placement-project-repaired",
    ["a"],
  );
  t.after(cleanup);
  const metaPath = join(root, "a", "single.mimimilli.json");
  const original = readFileSync(metaPath);
  writeFileSync(metaPath, "{ broken");
  await adapter.scan();
  assert.equal((await adapter.getWork(meta.id))?.physicalPath, metaPath);

  writeFileSync(metaPath, original);
  const result = await adapter.projectWorkSource("a/single.wav" as never);
  assert.equal(result?.projection.status, "published");
  const work = await adapter.getWork(meta.id);
  assert.equal(work?.status, "ok");
  assert.equal(work?.physicalPath, join(root, "a", "single.wav"));
  assert.deepEqual(await adapter.listScanDiagnostics(), []);
});

test("メタファイルを単一ファイル形式の名前に改名すると、増分scanでも配置を検査し直す（real）", async (t) => {
  const directory = makeTestDirectory("work-placement-renamed-meta");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const folder = join(root, "album");
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "track.wav"), 1);
  const meta = metaOf("album", [{ name: "default", files: ["track.wav"] }]);
  writeMetaFile(join(folder, META_FILE_NAME), meta);
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan();
  assert.equal((await adapter.getWork(meta.id))?.status, "ok");

  const renamed = join(folder, "single.mimimilli.json");
  renameSync(join(folder, META_FILE_NAME), renamed);
  assert.ok(!existsSync(join(folder, META_FILE_NAME)));
  await adapter.scan();
  const work = await adapter.getWork(meta.id);
  assert.equal(work?.status, "error");
  assert.equal(
    work?.errorMessage,
    `${PREFIX}single.mimimilli.json のトラックが参照する track.wav は、このメタファイルに対応する音声ファイルではありません`,
  );
  assert.equal(work?.physicalPath, renamed);
});
