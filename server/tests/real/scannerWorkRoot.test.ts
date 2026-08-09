// findWorkRoot のインデックス化（TASK-160）: 作品ルート判定の回帰・境界ケース
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { openDb } from "../../src/adapters/real/db.ts";
import { findWorkRoot, Scanner, walk } from "../../src/adapters/real/scanner.ts";
import { WorkRepo } from "../../src/adapters/real/workRepo.ts";
import { isPathWithin } from "../../src/lib/path.ts";
import { makeTestDirectory, writeSampleCover, writeWav } from "../helpers/sampleLibrary.ts";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp"]);

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** 変更前の findWorkRoot（回帰オラクル。本番コードとの等価性検証用） */
function findWorkRootLegacy(audioDir: string, root: string, metaDirs: Set<string>): string {
  let cur = audioDir;
  while (true) {
    const parent = dirname(cur);
    if (cur === root || parent === cur || !isPathWithin(root, parent) || parent === root) break;

    let swallowsMeta = false;
    for (const metaDir of metaDirs) {
      if (isPathWithin(parent, metaDir)) {
        swallowsMeta = true;
        break;
      }
    }
    if (swallowsMeta) break;

    let entries;
    try {
      entries = readdirSync(parent, { withFileTypes: true });
    } catch {
      break;
    }
    const subdirCount = entries.filter((e) => e.isDirectory()).length;
    const hasImage = entries.some((e) => e.isFile() && IMAGE_EXTENSIONS.has(extOf(e.name)));

    if (hasImage || subdirCount === 1) {
      cur = parent;
    } else {
      break;
    }
  }
  return cur;
}

/** 本番 walk / findWorkRoot が旧実装オラクルと一致することを検証する */
async function assertWorkRootEquivalence(rootInput: string): Promise<void> {
  const root = resolve(rootInput);
  const tree = await walk(root);
  for (const audioDir of tree.audioDirs) {
    const legacy = findWorkRootLegacy(audioDir, root, tree.metaDirs);
    const indexed = findWorkRoot(audioDir, root, tree.dirsWithMetaInSubtree, tree.dirIndex);
    assert.equal(indexed, legacy, `audioDir=${audioDir}`);
  }
}

test("findWorkRoot: カバー同梱で mp3/ から作品ルートへ昇格", async (t) => {
  const directory = makeTestDirectory("workroot-cover");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const work = join(root, "RJ900001_work");
  mkdirSync(join(work, "mp3"), { recursive: true });
  writeWav(join(work, "mp3", "track.wav"), 1);
  writeSampleCover(join(work, "cover.jpg"));
  await assertWorkRootEquivalence(root);

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const scanner = new Scanner(db, new WorkRepo(db), directory.path);
  const result = await scanner.scan(root);
  assert.equal(result.newlyGenerated, 1);
  assert.ok(existsSync(join(work, "mimimilli.json")));
  assert.ok(!existsSync(join(work, "mp3", "mimimilli.json")));
});

test("findWorkRoot: 単一サブフォルダーラッパーで昇格", async (t) => {
  const directory = makeTestDirectory("workroot-wrapper");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const outer = join(root, "wrapper");
  const inner = join(outer, "inner");
  mkdirSync(inner, { recursive: true });
  writeWav(join(inner, "track.wav"), 1);
  await assertWorkRootEquivalence(root);

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const scanner = new Scanner(db, new WorkRepo(db), directory.path);
  const result = await scanner.scan(root);
  assert.equal(result.newlyGenerated, 1);
  assert.ok(existsSync(join(outer, "mimimilli.json")));
});

test("findWorkRoot: 複数サブフォルダーではジャンルフォルダーへ昇格しない", async (t) => {
  const directory = makeTestDirectory("workroot-genre");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const genre = join(root, "genre");
  mkdirSync(join(genre, "album-a"), { recursive: true });
  mkdirSync(join(genre, "album-b"), { recursive: true });
  writeWav(join(genre, "album-a", "track.wav"), 1);
  await assertWorkRootEquivalence(root);

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const scanner = new Scanner(db, new WorkRepo(db), directory.path);
  const result = await scanner.scan(root);
  assert.equal(result.newlyGenerated, 1);
  assert.ok(existsSync(join(genre, "album-a", "mimimilli.json")));
  assert.ok(!existsSync(join(genre, "mimimilli.json")));
});

test("findWorkRoot: 兄弟メタ作品があれば親へ昇格しない", async (t) => {
  const directory = makeTestDirectory("workroot-sibling-meta");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const parent = join(root, "parent");
  const existing = join(parent, "existing-meta");
  const uncovered = join(parent, "uncovered");
  mkdirSync(existing, { recursive: true });
  mkdirSync(uncovered, { recursive: true });
  writeWav(join(existing, "track.wav"), 1);
  writeWav(join(uncovered, "track.wav"), 1);
  writeFileSync(
    join(existing, "mimimilli.json"),
    JSON.stringify({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "existing",
      playlists: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: "default",
          tracks: [
            {
              id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              title: "t",
              file: "track.wav",
            },
          ],
        },
      ],
      defaultPlaylistId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    }),
  );
  await assertWorkRootEquivalence(root);

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const scanner = new Scanner(db, new WorkRepo(db), directory.path);
  const result = await scanner.scan(root);
  assert.equal(result.registered, 1);
  assert.equal(result.newlyGenerated, 1);
  assert.ok(existsSync(join(uncovered, "mimimilli.json")));
  assert.ok(!existsSync(join(parent, "mimimilli.json")));
});

test("findWorkRoot: 深い単一サブフォルダー連鎖はルート直下まで昇格", async (t) => {
  const directory = makeTestDirectory("workroot-deep");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const work = join(root, "a", "b", "c", "d", "work");
  mkdirSync(work, { recursive: true });
  writeWav(join(work, "track.wav"), 1);
  await assertWorkRootEquivalence(root);

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const scanner = new Scanner(db, new WorkRepo(db), directory.path);
  const result = await scanner.scan(root);
  assert.equal(result.newlyGenerated, 1);
  assert.ok(existsSync(join(root, "a", "mimimilli.json")));
  assert.ok(!existsSync(join(work, "mimimilli.json")));
});

test("findWorkRoot: メタ無しaudioのみ・audio無しmetaは自動生成しない", async (t) => {
  const directory = makeTestDirectory("workroot-meta-only");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const metaOnly = join(root, "meta-only");
  mkdirSync(metaOnly, { recursive: true });
  writeFileSync(
    join(metaOnly, "mimimilli.json"),
    JSON.stringify({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      title: "meta only",
      playlists: [],
      defaultPlaylistId: null,
    }),
  );
  await assertWorkRootEquivalence(root);

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const scanner = new Scanner(db, new WorkRepo(db), directory.path);
  const result = await scanner.scan(root);
  assert.equal(result.registered, 1);
  assert.equal(result.newlyGenerated, 0);
});

test("findWorkRoot: 多数のメタ作品でもインデックス参照で等価", async (t) => {
  const directory = makeTestDirectory("workroot-many-meta");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const uncovered = join(root, "uncovered", "inner");
  mkdirSync(uncovered, { recursive: true });
  writeWav(join(uncovered, "track.wav"), 1);
  for (let i = 0; i < 40; i++) {
    const workDir = join(root, `meta-work-${i}`);
    mkdirSync(workDir, { recursive: true });
    writeWav(join(workDir, "track.wav"), 1);
    writeFileSync(
      join(workDir, "mimimilli.json"),
      JSON.stringify({
        id: `eeeeeeee-eeee-4eee-8eee-${String(i).padStart(12, "0")}`,
        title: `work-${i}`,
        playlists: [
          {
            id: `ffffffff-ffff-4fff-8fff-${String(i).padStart(12, "0")}`,
            name: "default",
            tracks: [
              {
                id: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
                title: "t",
                file: "track.wav",
              },
            ],
          },
        ],
        defaultPlaylistId: `ffffffff-ffff-4fff-8fff-${String(i).padStart(12, "0")}`,
      }),
    );
  }
  await assertWorkRootEquivalence(root);
});

test("findWorkRoot: 非正規化root（末尾スラッシュ・./）でも旧実装と等価", async (t) => {
  const directory = makeTestDirectory("workroot-root-normalize");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const work = join(root, "RJ_work");
  mkdirSync(join(work, "mp3"), { recursive: true });
  writeWav(join(work, "mp3", "track.wav"), 1);
  writeSampleCover(join(work, "cover.jpg"));

  await assertWorkRootEquivalence(`${root}/`);
  await assertWorkRootEquivalence(join(directory.path, "./lib"));

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const scanner = new Scanner(db, new WorkRepo(db), directory.path);
  const resultTrailing = await scanner.scan(`${root}/`);
  assert.equal(resultTrailing.newlyGenerated, 1);
  assert.ok(existsSync(join(work, "mimimilli.json")));

  rmSync(join(work, "mimimilli.json"));
  const resultDot = await scanner.scan(join(directory.path, "./lib"));
  assert.equal(resultDot.newlyGenerated, 1);
  assert.ok(existsSync(join(work, "mimimilli.json")));
});
