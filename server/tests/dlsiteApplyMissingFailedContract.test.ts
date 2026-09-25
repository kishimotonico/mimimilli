// dlsiteApplyMissing の failed 計上（DLsite取得に失敗した作品はfailedに数え、他の作品の
// 適用は止めない）を、real・fixture 両adapterで同じ結果になることを縛る契約テスト。
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { emptyDlsiteState, type WorkSummary } from "@mimimilli/shared";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { FIXTURE_DLSITE_FETCH_FAILURE_RJ_CODE } from "../src/adapters/fixture/dlsiteMethods.ts";
import { createRealAdapter } from "../src/adapters/real/index.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../src/adapters/real/dlsiteConfig.ts";
import { htmlResponse, mockDlsiteTransport, sampleWorkHtml } from "./helpers/dlsiteTransport.ts";
import { makeTestDirectory, writeWav } from "./helpers/sampleLibrary.ts";

const FAST_DLSITE_REQUEST_CONFIG = {
  ...DEFAULT_DLSITE_REQUEST_CONFIG,
  requestIntervalMs: 0,
  retryCount: 0,
  maxBackoffMs: 0,
  timeoutMs: 1_000,
};

test("dlsiteApplyMissing: 取得失敗はfailedへ数え、他の作品の適用は続く（fixture）", async () => {
  const baseWork: Omit<WorkSummary, "id" | "status" | "dlsite"> = {
    title: "テスト作品",
    cover: null,
    physicalPath: "/library/test",
    totalDurationSec: 0,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
  };
  const works: WorkSummary[] = [
    {
      ...baseWork,
      id: "ok-1",
      status: "ok",
      dlsite: { ...emptyDlsiteState(), rjCode: "RJ000001" },
    },
    {
      ...baseWork,
      id: "fail-1",
      status: "ok",
      dlsite: { ...emptyDlsiteState(), rjCode: FIXTURE_DLSITE_FETCH_FAILURE_RJ_CODE },
    },
  ];
  const adapter = createFixtureAdapter({ works });

  const result = await adapter.dlsiteApplyMissing(["ok-1", "fail-1"]);
  assert.deepEqual(result, { applied: 1, pending: 0, skipped: 0, failed: 1 });

  const applied = await adapter.getWork("ok-1");
  assert.ok(applied!.tags.length > 0, "取得できた作品は適用が続く");
  assert.equal(applied!.dlsite.status, "applied", "差分適用でlinkageがappliedになる");
  assert.equal(applied!.dlsite.rjCode, "RJ000001");
  assert.deepEqual(applied!.dlsite.appliedTags, applied!.tags);
  const failedWork = await adapter.getWork("fail-1");
  assert.deepEqual(failedWork!.tags, [], "取得に失敗した作品は変更されない");
  assert.equal(failedWork!.dlsite.status, "none", "取得に失敗した作品のlinkageは変更されない");
});

test("dlsiteApplyMissing: 取得失敗はfailedへ数え、他の作品の適用は続く（real）", async (t) => {
  const dir = makeTestDirectory("dlsite-apply-missing-failed-contract");
  t.after(dir.cleanup);
  const root = join(dir.path, "library");
  const okId = "33333333-3333-4333-8333-333333333333";
  const failId = "44444444-4444-4444-8444-444444444444";
  const okDir = join(root, "RJ900201_成功する作品");
  const failDir = join(root, "RJ900202_失敗する作品");
  const createWork = (workDir: string, id: string, title: string, rjCode: string) => {
    mkdirSync(workDir, { recursive: true });
    writeWav(join(workDir, "track.wav"), 1);
    writeFileSync(
      join(workDir, "mimimilli.json"),
      `${JSON.stringify(
        {
          formatVersion: 1,
          id,
          title,
          playlists: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              name: "default",
              tracks: [
                { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "本編", file: "track.wav" },
              ],
            },
          ],
          defaultPlaylistId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          dlsite: {
            ...emptyDlsiteState(),
            rjCode,
          },
        },
        null,
        2,
      )}\n`,
    );
  };
  createWork(okDir, okId, "成功する作品", "RJ900201");
  createWork(failDir, failId, "失敗する作品", "RJ900202");

  const adapter = dir.own(
    createRealAdapter({
      database: { kind: "memory" },
      dlsiteCache: { path: join(dir.path, "cache.sqlite") },
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) =>
          code === "RJ900202"
            ? htmlResponse("<html>404</html>", 404)
            : htmlResponse(sampleWorkHtml(code, { cover: false })),
      }),
    }),
  );
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();

  const result = await adapter.dlsiteApplyMissing();
  assert.deepEqual(result, { applied: 1, pending: 0, skipped: 0, failed: 1 });

  const applied = await adapter.getWork(okId);
  assert.equal(applied!.dlsite.status, "applied", "差分適用でlinkageがappliedになる");
  assert.equal(applied!.dlsite.rjCode, "RJ900201");
  assert.deepEqual(applied!.dlsite.appliedTags, applied!.tags);
  const failedWork = await adapter.getWork(failId);
  assert.equal(failedWork!.dlsite.status, "not_found", "取得失敗はキャッシュ由来の表示のまま");
});
