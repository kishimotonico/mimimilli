import assert from "node:assert/strict";
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { installBytes } from "../../src/adapters/real/atomicFile.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

test("最終名がディレクトリなら退避せず失敗し、ディレクトリも一時ファイルも残らない", (t) => {
  const dir = makeTestDirectory("atomic-file-directory");
  t.after(dir.cleanup);
  const target = join(dir.path, "target");
  mkdirSync(target);
  writeFileSync(join(target, "keep.txt"), "keep");

  assert.throws(() => installBytes(target, Buffer.from("x")));
  assert.ok(lstatSync(target).isDirectory());
  assert.equal(readFileSync(join(target, "keep.txt"), "utf-8"), "keep");
  assert.deepEqual(readdirSync(dir.path), ["target"]);
});

test("既存の通常ファイルは置き換わり、一時ファイルとrollbackは残らない", (t) => {
  const dir = makeTestDirectory("atomic-file-replace");
  t.after(dir.cleanup);
  const target = join(dir.path, "target");
  writeFileSync(target, "old");
  installBytes(target, Buffer.from("new"));
  assert.equal(readFileSync(target, "utf-8"), "new");
  assert.deepEqual(readdirSync(dir.path), ["target"]);
});
