// 登録プレビューの名前由来の規則（RJコード検出・タイトル候補）がreal/fixtureで一致する。
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { workspacePath } from "@mimimilli/shared";
import type { DataAdapter } from "../src/adapter/index.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { requireConfiguredRoot } from "../src/core/rootFolder.ts";
import { NotConfiguredError } from "../src/errors.ts";
import { configureRoot } from "./helpers/rootFolder.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { makeTestDirectory, writeWav } from "./helpers/sampleLibrary.ts";

const FOLDERS = ["RJ123456 サンプル作品", "rj01234567_lower", "plain-folder"];
const FILES = ["RJ654321 track.wav", "single.take.wav"];

async function previewNaming(adapter: DataAdapter, name: string) {
  const preview = await adapter.getWorkRegisterPreview(workspacePath(name));
  assert.ok(preview, name);
  return { suggestedTitle: preview.suggestedTitle, detectedRjCode: preview.detectedRjCode };
}

async function collect(adapter: DataAdapter) {
  const entries: Record<string, unknown> = {};
  for (const name of [...FOLDERS, ...FILES]) entries[name] = await previewNaming(adapter, name);
  return entries;
}

const EXPECTED = {
  "RJ123456 サンプル作品": { suggestedTitle: "RJ123456 サンプル作品", detectedRjCode: "RJ123456" },
  rj01234567_lower: { suggestedTitle: "rj01234567_lower", detectedRjCode: "RJ01234567" },
  "plain-folder": { suggestedTitle: "plain-folder", detectedRjCode: null },
  "RJ654321 track.wav": { suggestedTitle: "RJ654321 track", detectedRjCode: "RJ654321" },
  "single.take.wav": { suggestedTitle: "single.take", detectedRjCode: null },
};

test("登録プレビューのタイトル候補とRJコード検出がrealとfixtureで一致する", async (t) => {
  const directory = makeTestDirectory("work-register-preview-contract");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  mkdirSync(root, { recursive: true });
  for (const name of FOLDERS) mkdirSync(join(root, name));
  for (const name of FILES) writeWav(join(root, name), 1);

  const real = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(real, root);

  assert.deepEqual(await collect(real), EXPECTED);
  assert.deepEqual(await collect(createFixtureAdapter()), EXPECTED);
});

test("ルートフォルダー未設定は NotConfiguredError になる", () => {
  assert.throws(() => requireConfiguredRoot(null), NotConfiguredError);
  assert.throws(() => requireConfiguredRoot(""), NotConfiguredError);
  assert.equal(requireConfiguredRoot("/library"), "/library");
});
