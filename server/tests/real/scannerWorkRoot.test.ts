import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { openDb } from "../../src/adapters/real/db.ts";
import { Scanner } from "../../src/adapters/real/scanner.ts";
import { createWorkRepos } from "../helpers/workTestUtils.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

test("複数のdiscフォルダーを一つの未登録候補へ統合し、mimimilli.jsonを書き込まない", async (t) => {
  const directory = makeTestDirectory("candidate-multidisc");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const work = join(root, "作品");
  mkdirSync(join(work, "disc 1"), { recursive: true });
  mkdirSync(join(work, "disc 2"), { recursive: true });
  writeWav(join(work, "disc 1", "a.wav"), 1);
  writeWav(join(work, "disc 2", "b.wav"), 1);

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const scanner = new Scanner(db, createWorkRepos(db));
  const result = await scanner.scan(root);

  assert.deepEqual(result.candidates, [
    {
      path: "作品",
      inferredTitle: "作品",
      audioFileCount: 2,
      audioBreakdown: [{ extension: "wav", count: 2 }],
    },
  ]);
  assert.equal(result.newlyGenerated, 0);
  assert.equal(existsSync(join(work, "mimimilli.json")), false);
});

test("ルート直下の音声は親フォルダー候補へ昇格しない", async (t) => {
  const directory = makeTestDirectory("candidate-root-audio");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  mkdirSync(root, { recursive: true });
  writeWav(join(root, "track.wav"), 1);

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const scanner = new Scanner(db, createWorkRepos(db));
  const result = await scanner.scan(root);

  assert.deepEqual(result.candidates, []);
  assert.equal(existsSync(join(root, "mimimilli.json")), false);
});

test("mimimilli.jsonがある既存作品は未登録候補として再判定しない", async (t) => {
  const directory = makeTestDirectory("candidate-existing");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const work = join(root, "既存作品");
  mkdirSync(work, { recursive: true });
  writeWav(join(work, "track.wav"), 1);
  const source = JSON.stringify({
    formatVersion: 1,
    id: crypto.randomUUID(),
    title: "既存",
    playlists: [],
    defaultPlaylistId: null,
  });
  writeFileSync(join(work, "mimimilli.json"), source);

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const scanner = new Scanner(db, createWorkRepos(db));
  const result = await scanner.scan(root);

  assert.deepEqual(result.candidates, []);
  assert.equal(existsSync(join(work, "mimimilli.json")), true);
});
