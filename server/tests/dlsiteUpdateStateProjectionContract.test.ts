// updateDlsiteState後の投影（meta linkageとDLsite取得キャッシュの合成）が、
// real・fixture 両adapterで同じ結果になることを縛る契約テスト。
// 3操作（同一RJコード再送信・RJコード変更・スキップ切替）を、キャッシュ済みの取得失敗
// （not_found）がある状態から行い、composited dlsiteの投影が一致することを確認する。
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { DlsiteCacheResolution, WorkSummary } from "@mimimilli/shared";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createRealAdapter } from "../src/adapters/real/index.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../src/adapters/real/dlsiteConfig.ts";
import { htmlResponse, mockDlsiteTransport } from "./helpers/dlsiteTransport.ts";
import { makeTestDirectory, writeWav } from "./helpers/sampleLibrary.ts";
import { configureRoot } from "./helpers/rootFolder.ts";

const FAST_DLSITE_REQUEST_CONFIG = {
  ...DEFAULT_DLSITE_REQUEST_CONFIG,
  requestIntervalMs: 0,
  retryCount: 0,
  maxBackoffMs: 0,
  timeoutMs: 1_000,
};

const RJ_CODE = "RJ700001";
const OTHER_RJ_CODE = "RJ700002";
const WORK_ID = "work-1";

function makeWork(): WorkSummary {
  return {
    id: WORK_ID,
    title: "テスト作品",
    cover: null,
    status: "ok",
    physicalPath: "/library/work-1",
    totalDurationSec: 0,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: {
      rjCode: RJ_CODE,
      status: "none",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: [],
    },
  };
}

const CACHED_NOT_FOUND: DlsiteCacheResolution = {
  kind: "failure",
  outcome: "not_found",
  attemptedAt: Date.parse("2026-01-01T00:00:00.000Z"),
  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
};

test("updateDlsiteState: 同じRJコードの再送信は取得失敗表示を保持する（fixture）", async () => {
  const adapter = createFixtureAdapter({
    works: [makeWork()],
    dlsiteFetchFailures: [{ rjCode: RJ_CODE, resolution: CACHED_NOT_FOUND }],
  });
  const before = await adapter.getWork(WORK_ID);
  assert.equal(before?.dlsite.status, "not_found");

  const snapshot = await adapter.getWorkEditSnapshot(WORK_ID);
  assert.equal(snapshot?.dlsite.status, "none"); // meta linkageはcacheの失敗を持たない
  await adapter.updateDlsiteState(WORK_ID, {
    sourceRevision: snapshot!.sourceRevision,
    rjCode: RJ_CODE,
  });

  const after = await adapter.getWork(WORK_ID);
  assert.equal(after?.dlsite.status, "not_found");
  assert.ok(after?.dlsite.error);
});

test("updateDlsiteState: RJコード変更は取得失敗表示をリセットする（fixture）", async () => {
  const adapter = createFixtureAdapter({
    works: [makeWork()],
    dlsiteFetchFailures: [{ rjCode: RJ_CODE, resolution: CACHED_NOT_FOUND }],
  });
  const snapshot = await adapter.getWorkEditSnapshot(WORK_ID);
  await adapter.updateDlsiteState(WORK_ID, {
    sourceRevision: snapshot!.sourceRevision,
    rjCode: OTHER_RJ_CODE,
  });
  const after = await adapter.getWork(WORK_ID);
  assert.equal(after?.dlsite.status, "none");
  assert.equal(after?.dlsite.error, null);
});

test("updateDlsiteState: スキップ切替は取得失敗表示より優先される（fixture）", async () => {
  const adapter = createFixtureAdapter({
    works: [makeWork()],
    dlsiteFetchFailures: [{ rjCode: RJ_CODE, resolution: CACHED_NOT_FOUND }],
  });
  const snapshot = await adapter.getWorkEditSnapshot(WORK_ID);
  await adapter.updateDlsiteState(WORK_ID, {
    sourceRevision: snapshot!.sourceRevision,
    skipped: true,
  });
  const after = await adapter.getWork(WORK_ID);
  assert.equal(after?.dlsite.status, "skipped");
  assert.equal(after?.dlsite.error, null);
});

async function setupRealWithCachedFailure(t: TestContext) {
  const dir = makeTestDirectory("dlsite-update-state-contract");
  t.after(dir.cleanup);
  const root = join(dir.path, "library");
  const workDir = join(root, `${RJ_CODE}_テスト作品`);
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
  writeFileSync(
    join(workDir, "mimimilli.json"),
    `${JSON.stringify(
      {
        formatVersion: 1,
        id: "11111111-1111-4111-8111-111111111111",
        title: "テスト作品",
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
        dlsite: { rjCode: RJ_CODE, status: "none", appliedTags: [] },
      },
      null,
      2,
    )}\n`,
  );
  const adapter = dir.own(
    createRealAdapter({
      database: { kind: "memory" },
      dlsiteCache: { path: join(dir.path, "cache.sqlite") },
      dlsiteRequestConfig: FAST_DLSITE_REQUEST_CONFIG,
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: () => htmlResponse("<html>404</html>", 404),
      }),
    }),
  );
  await configureRoot(adapter, root);
  await adapter.scan();
  const before = await adapter.getWork("11111111-1111-4111-8111-111111111111");
  const workId = before!.id;
  const bulk = await adapter.runDlsiteBulk("existing", [workId]);
  assert.equal(bulk.failed, 1);
  const failed = await adapter.getWork(workId);
  assert.equal(failed?.dlsite.status, "not_found");
  return { adapter, workId };
}

test("updateDlsiteState: 同じRJコードの再送信は取得失敗表示を保持する（real）", async (t) => {
  const { adapter, workId } = await setupRealWithCachedFailure(t);
  const snapshot = await adapter.getWorkEditSnapshot(workId);
  assert.equal(snapshot?.dlsite.status, "none"); // meta linkageはcacheの失敗を持たない
  await adapter.updateDlsiteState(workId, {
    sourceRevision: snapshot!.sourceRevision,
    rjCode: RJ_CODE,
  });
  const after = await adapter.getWork(workId);
  assert.equal(after?.dlsite.status, "not_found");
  assert.ok(after?.dlsite.error);
});

test("updateDlsiteState: RJコード変更は取得失敗表示をリセットする（real）", async (t) => {
  const { adapter, workId } = await setupRealWithCachedFailure(t);
  const snapshot = await adapter.getWorkEditSnapshot(workId);
  await adapter.updateDlsiteState(workId, {
    sourceRevision: snapshot!.sourceRevision,
    rjCode: OTHER_RJ_CODE,
  });
  const after = await adapter.getWork(workId);
  assert.equal(after?.dlsite.status, "none");
  assert.equal(after?.dlsite.error, null);
});

test("updateDlsiteState: スキップ切替は取得失敗表示より優先される（real）", async (t) => {
  const { adapter, workId } = await setupRealWithCachedFailure(t);
  const snapshot = await adapter.getWorkEditSnapshot(workId);
  await adapter.updateDlsiteState(workId, {
    sourceRevision: snapshot!.sourceRevision,
    skipped: true,
  });
  const after = await adapter.getWork(workId);
  assert.equal(after?.dlsite.status, "skipped");
  assert.equal(after?.dlsite.error, null);
});
