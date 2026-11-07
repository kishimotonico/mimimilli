// real: カバー計測・DTO・配信・audio配信が、作品のmediaRoot内の通常ファイルだけを対象にすること。
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";
import type { WorksPage } from "@mimimilli/shared";
import { createApp } from "../helpers/testApp.ts";
import { configureRoot } from "../helpers/rootFolder.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { scanAndRegisterCandidates } from "../helpers/scanLibrary.ts";
import {
  makeSampleLibrary,
  makeTestDirectory,
  writeSampleCover,
} from "../helpers/sampleLibrary.ts";

const FIFO_SUPPORTED = process.platform !== "win32";
const TEST_TIMEOUT_MS = 10_000;

async function setup(t: TestContext) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const outside = makeTestDirectory("cover-containment-outside");
  t.after(outside.cleanup);
  const adapter = lib.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  await configureRoot(adapter, lib.root);
  await scanAndRegisterCandidates(adapter);
  const works = (await (await app.request("/api/works")).json()) as WorksPage;
  const workId = works.items.find((entry) => entry.title.includes("RJ900001"))!.id;
  const workDir = join(lib.root, "dlsite", "RJ900001_テスト作品");
  return { lib, adapter, app, workId, workDir, outsideDir: outside.path };
}

function rewriteCoverImage(workDir: string, coverImage: string): void {
  const metaPath = join(workDir, "mimimilli.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
  meta.coverImage = coverImage;
  writeFileSync(metaPath, JSON.stringify(meta));
  const future = new Date(Date.now() + 5_000);
  utimesSync(metaPath, future, future);
}

type EscapeCase = { name: string; prepare(ctx: Awaited<ReturnType<typeof setup>>): string };

const ESCAPE_CASES: EscapeCase[] = [
  {
    name: "親へ抜ける相対パス",
    prepare: ({ workDir }) => {
      writeSampleCover(join(dirname(workDir), "outside.jpg"));
      return "../outside.jpg";
    },
  },
  {
    name: "絶対パス",
    prepare: ({ outsideDir }) => {
      const absolute = join(outsideDir, "absolute.jpg");
      writeSampleCover(absolute);
      return absolute;
    },
  },
  {
    name: "ルート外ファイルへのsymlink",
    prepare: ({ workDir, outsideDir }) => {
      const target = join(outsideDir, "linked.jpg");
      writeSampleCover(target);
      symlinkSync(target, join(workDir, "linked.jpg"));
      return "linked.jpg";
    },
  },
  {
    name: "ディレクトリ",
    prepare: ({ workDir }) => {
      mkdirSync(join(workDir, "cover-dir"));
      return "cover-dir";
    },
  },
];

if (FIFO_SUPPORTED) {
  ESCAPE_CASES.push({
    name: "FIFO",
    prepare: ({ workDir }) => {
      execFileSync("mkfifo", [join(workDir, "cover.fifo")]);
      return "cover.fifo";
    },
  });
}

for (const escapeCase of ESCAPE_CASES) {
  test(
    `real: coverImageが${escapeCase.name}のとき、計測されずカバーなしになる`,
    { timeout: TEST_TIMEOUT_MS },
    async (t) => {
      const ctx = await setup(t);
      const coverImage = escapeCase.prepare(ctx);
      rewriteCoverImage(ctx.workDir, coverImage);

      const result = await ctx.adapter.scan();
      assert.equal(result.skipped, 0);
      assert.equal(result.coverErrors, 1);

      const work = await ctx.adapter.getWork(ctx.workId);
      assert.equal(work!.cover, null);
      assert.equal(work!.coverKind, "unmeasured");

      const res = await ctx.app.request(`/api/media/cover/${ctx.workId}`);
      assert.equal(res.status, 404);
    },
  );
}

test("real: mediaRoot内の通常ファイルはこれまでどおり計測される", async (t) => {
  const ctx = await setup(t);
  mkdirSync(join(ctx.workDir, "art"));
  writeSampleCover(join(ctx.workDir, "art", "inner.jpg"));
  rewriteCoverImage(ctx.workDir, "art/inner.jpg");

  const result = await ctx.adapter.scan();
  assert.equal(result.coverErrors, 0);
  const work = await ctx.adapter.getWork(ctx.workId);
  assert.deepEqual(work!.cover?.dimensions, { width: 6, height: 4 });
});

const REGISTERED_AUDIO = "mp3/01_intro.wav";

test("real: audio配信は登録済みトラックがディレクトリに差し替わっていたら404", async (t) => {
  const { app, workId, workDir } = await setup(t);
  rmSync(join(workDir, REGISTERED_AUDIO));
  mkdirSync(join(workDir, REGISTERED_AUDIO));

  const res = await app.request(`/api/media/audio/${workId}/${REGISTERED_AUDIO}`);
  assert.equal(res.status, 404);
});

test(
  "real: audio配信は登録済みトラックがFIFOに差し替わっていても404でハングしない",
  { skip: !FIFO_SUPPORTED, timeout: TEST_TIMEOUT_MS },
  async (t) => {
    const { app, workId, workDir } = await setup(t);
    rmSync(join(workDir, REGISTERED_AUDIO));
    execFileSync("mkfifo", [join(workDir, REGISTERED_AUDIO)]);

    const res = await app.request(`/api/media/audio/${workId}/${REGISTERED_AUDIO}`);
    assert.equal(res.status, 404);
  },
);

test("real: audio配信は登録済みトラックがルート外へのsymlinkなら404", async (t) => {
  const { app, workId, workDir, outsideDir } = await setup(t);
  const target = join(outsideDir, "outside.wav");
  writeFileSync(target, "outside");
  rmSync(join(workDir, REGISTERED_AUDIO));
  symlinkSync(target, join(workDir, REGISTERED_AUDIO));

  const res = await app.request(`/api/media/audio/${workId}/${REGISTERED_AUDIO}`);
  assert.equal(res.status, 404);
});
