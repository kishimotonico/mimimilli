// real: kind ごとのメディア解決境界（登録済み音声・未登録音声・パストラバーサル）。
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { WorksPage } from "@mimimilli/shared";
import { createApp, type App } from "../src/app.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { scanAndRegisterCandidates } from "./helpers/scanLibrary.ts";
import { makeSampleLibrary } from "./helpers/sampleLibrary.ts";
import { configureRoot } from "./helpers/rootFolder.ts";

const REGISTERED_AUDIO = "mp3/01_intro.wav";
const UNREGISTERED_AUDIO = "cover.jpg";
const TRAVERSAL_PATHS = [
  "..%2Fsecret.txt",
  "..%2F..%2F..%2Fetc%2Fpasswd",
  "mp3%2F..%2F..%2Fsecret.txt",
];

async function setup(t: TestContext): Promise<{ app: App; workId: string }> {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  writeFileSync(join(lib.root, "secret.txt"), "library-secret");
  const adapter = lib.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  await configureRoot(adapter, lib.root);
  await scanAndRegisterCandidates(adapter);
  const works = (await (await app.request("/api/works")).json()) as WorksPage;
  const workId = works.items.find((entry) => entry.title.includes("RJ900001"))!.id;
  return { app, workId };
}

test("real: 登録済み音声は audio 経路で配信できる", async (t) => {
  const { app, workId } = await setup(t);
  const res = await app.request(`/api/media/audio/${workId}/${REGISTERED_AUDIO}`);
  assert.equal(res.status, 200);
});

test("real: 未登録の既存ファイルは audio 経路で 404", async (t) => {
  const { app, workId } = await setup(t);
  const res = await app.request(`/api/media/audio/${workId}/${UNREGISTERED_AUDIO}`);
  assert.equal(res.status, 404);
});

test("real: audio 経路のパストラバーサルは 404", async (t) => {
  const { app, workId } = await setup(t);
  for (const rel of TRAVERSAL_PATHS) {
    const res = await app.request(`/api/media/audio/${workId}/${rel}`);
    assert.equal(res.status, 404, `should block audio: ${rel}`);
  }
});
