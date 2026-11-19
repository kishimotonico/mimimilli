// 単一値prefix（サークル・rating）の置換セマンティクスを、
// real・fixture 両adapterで同じ結果になることを縛る契約テスト。
// 片方のadapterだけをモックしたテストでは、adapter間の意味論のずれを検知できない。
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import type { DlsiteWorkInfo } from "@mimimilli/shared";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createRealAdapter } from "../src/adapters/real/index.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../src/adapters/real/dlsiteConfig.ts";
import { htmlResponse, mockDlsiteTransport, sampleWorkHtml } from "./helpers/dlsiteTransport.ts";
import { makeSampleLibrary, makeTestDirectory } from "./helpers/sampleLibrary.ts";
import { nt, nts } from "./helpers/tag.ts";
import { configureRoot } from "./helpers/rootFolder.ts";

const FAST_DLSITE_REQUEST_CONFIG = {
  ...DEFAULT_DLSITE_REQUEST_CONFIG,
  requestIntervalMs: 0,
  retryCount: 0,
  maxBackoffMs: 0,
  timeoutMs: 1_000,
};

function countCircleTags(tags: readonly string[]): number {
  return tags.filter((tag) => tag.startsWith("サークル/")).length;
}

test("replace: 単体適用で明示的に選んだサークルは既存の同prefixタグを置き換える（real/fixture契約）", async (t) => {
  const fixtureInfo: DlsiteWorkInfo = {
    rjCode: "RJ501011",
    title: "x",
    circle: "fixtureサークル",
    cvs: [],
    genreTags: [],
    ageRating: null,
    coverUrl: null,
    url: "https://www.dlsite.com/maniax/work/=/product_id/RJ501011.html",
  };
  const fixtureAdapter = createFixtureAdapter();
  const fixtureApplied = await fixtureAdapter.dlsiteApply("RJ501011", {
    info: fixtureInfo,
    sourceRevision: "fixture",
    applyTitle: false,
    applyTags: nts(["サークル/fixtureサークル"]),
    applyCover: false,
    applyUrl: false,
  });
  assert.ok(fixtureApplied?.snapshot);
  const fixtureWork = await fixtureAdapter.getWork("RJ501011");
  assert.equal(countCircleTags(fixtureWork!.tags), 1, "fixture: 置換後もサークルは1値");
  assert.ok(fixtureWork!.tags.includes(nt("サークル/fixtureサークル")));
  assert.ok(!fixtureWork!.tags.includes(nt("サークル/月白製作所")));

  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-tag-cardinality-real-replace");
  t.after(lib.cleanup);
  t.after(dir.cleanup);
  const realAdapter = dir.own(
    createRealAdapter({
      database: { kind: "memory" },
      dlsiteCache: { path: join(dir.path, "cache.sqlite") },
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) => htmlResponse(sampleWorkHtml(code, { circle: "満月堂", cover: false })),
      }),
    }),
  );
  await configureRoot(realAdapter, lib.root);
  await realAdapter.scan();
  const realInfo: DlsiteWorkInfo = {
    rjCode: "RJ900002",
    title: "x",
    circle: "満月堂",
    cvs: [],
    genreTags: [],
    ageRating: null,
    coverUrl: null,
    url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
  };
  const realApplied = await realAdapter.dlsiteApply(lib.existingWorkId, {
    info: realInfo,
    sourceRevision: (await realAdapter.getWorkEditSnapshot(lib.existingWorkId))!.sourceRevision,
    applyTitle: false,
    applyTags: nts(["サークル/満月堂"]),
    applyCover: false,
    applyUrl: false,
  });
  assert.ok(realApplied?.snapshot);
  const realWork = await realAdapter.getWork(lib.existingWorkId);
  assert.equal(countCircleTags(realWork!.tags), 1, "real: 置換後もサークルは1値");
  assert.ok(realWork!.tags.includes(nt("サークル/満月堂")));
  assert.ok(!realWork!.tags.includes(nt("サークル/夜想曲")));
});
