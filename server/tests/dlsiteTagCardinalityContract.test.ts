// 単一値prefix（サークル・rating）の非破壊マージ・置換セマンティクスを、
// real・fixture 両adapterで同じ結果になることを縛る契約テスト（TASK-428.1）。
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

test("fill-unset: サークルは既存と異なる値でも2値共存にしない（real/fixture契約）", async (t) => {
  // fixture: RJ501011 は既存タグに サークル/月白製作所 を持つ。fixtureのDLsite取得は
  // 常に circle: "fixtureサークル" を返すため、既存と異なる値が来る条件を満たす
  const fixtureAdapter = createFixtureAdapter();
  const fixtureResult = await fixtureAdapter.dlsiteApplyMissing(["RJ501011"]);
  assert.equal(fixtureResult.applied, 1, "fixture: cv/genre/ratingが新規なので適用は起きる");
  const fixtureWork = await fixtureAdapter.getWork("RJ501011");
  assert.equal(countCircleTags(fixtureWork!.tags), 1, "fixture: サークルは1値のまま");
  assert.ok(fixtureWork!.tags.includes(nt("サークル/月白製作所")), "fixture: 既存のサークルを保持");
  assert.ok(
    !fixtureWork!.tags.includes(nt("サークル/fixtureサークル")),
    "fixture: 新サークルは追加しない",
  );
  assert.ok(fixtureWork!.tags.includes(nt("cv/fixture CV")), "fixture: 新規cvは追加する");

  // real: 既存タグに サークル/夜想曲 を持つ作品へ、異なる circle（満月堂）を返すDLsiteを紐付ける
  const lib = makeSampleLibrary();
  const dir = makeTestDirectory("dlsite-tag-cardinality-real-fill-unset");
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
  await realAdapter.updateSettings({ rootFolder: lib.root });
  await realAdapter.scan();
  const realResult = await realAdapter.dlsiteApplyMissing([lib.existingWorkId]);
  assert.equal(realResult.applied, 1, "real: genre/ratingが新規なので適用は起きる");
  const realWork = await realAdapter.getWork(lib.existingWorkId);
  assert.equal(countCircleTags(realWork!.tags), 1, "real: サークルは1値のまま");
  assert.ok(realWork!.tags.includes(nt("サークル/夜想曲")), "real: 既存のサークルを保持");
  assert.ok(!realWork!.tags.includes(nt("サークル/満月堂")), "real: 新サークルは追加しない");
});

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
    sourceRevision: "unused-by-fixture",
    applyTitle: false,
    applyTags: nts(["サークル/fixtureサークル"]),
    applyCover: false,
    applyUrl: false,
  });
  assert.equal(fixtureApplied, true);
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
  await realAdapter.updateSettings({ rootFolder: lib.root });
  await realAdapter.scan();
  const before = await realAdapter.getWork(lib.existingWorkId);
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
    sourceRevision: before!.sourceRevision!,
    applyTitle: false,
    applyTags: nts(["サークル/満月堂"]),
    applyCover: false,
    applyUrl: false,
  });
  assert.equal(realApplied, true);
  const realWork = await realAdapter.getWork(lib.existingWorkId);
  assert.equal(countCircleTags(realWork!.tags), 1, "real: 置換後もサークルは1値");
  assert.ok(realWork!.tags.includes(nt("サークル/満月堂")));
  assert.ok(!realWork!.tags.includes(nt("サークル/夜想曲")));
});
