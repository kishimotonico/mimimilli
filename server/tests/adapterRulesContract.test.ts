// TASK-338: resume検証・DLsite適用パッチ・登録重複チェックが real/fixture 両adapterで
// 同じ意味になることを縛る契約テスト。境界より手前のモックではなく、両adapterを
// DataAdapter インターフェース経由で実際に通して結果を比較する。
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { DlsiteWorkInfo } from "@mimimilli/shared";
import type { DataAdapter } from "../src/adapter/index.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { InvalidResumeError } from "../src/errors.ts";
import { WorkRegisterError } from "../src/errors.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { makeSampleLibrary, makeTestDirectory, writeWav } from "./helpers/sampleLibrary.ts";
import { nts } from "./helpers/tag.ts";

const RESUME_WORK_ID = "resume-contract-work";

function fixtureResumeAdapter(): DataAdapter {
  return createFixtureAdapter({
    works: [
      {
        id: RESUME_WORK_ID,
        title: "resume契約テスト用作品",
        cover: null,
        status: "ok",
        physicalPath: "/library/resume-contract-work.wav",
        totalDurationSec: 1,
        addedAt: "2026-01-01T00:00:00.000Z",
        errorMessage: null,
        urls: [],
        tags: [],
        trackCount: 1,
        bookmarked: false,
        lastPlayedAt: null,
        dlsite: {
          rjCode: null,
          status: "none",
          lastAttemptAt: null,
          error: null,
          errorKind: null,
          appliedTags: [],
        },
      },
    ],
  });
}

async function realResumeAdapter(
  t: TestContext,
): Promise<{ adapter: DataAdapter; workId: string }> {
  const dir = makeTestDirectory("resume-contract");
  t.after(dir.cleanup);
  const root = join(dir.path, "library");
  const workDir = join(root, "resume-contract-work");
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
  const adapter = dir.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: root });
  const scan = await adapter.scan();
  const registration = await adapter.registerScanCandidates(
    scan.candidates.map((candidate) => ({ path: candidate.path })),
  );
  const workId = registration.registered[0]!.workId;
  return { adapter, workId };
}

async function assertResumeContract(adapter: DataAdapter, workId: string, label: string) {
  const work = await adapter.getWork(workId);
  const playlist = work!.playlists[0]!;
  const track = playlist.tracks[0]!;
  assert.ok(track.durationSec !== null, `${label}: durationSecが解決されていること`);

  await assert.rejects(
    () =>
      adapter.saveResume(workId, {
        playlistId: playlist.id,
        trackId: crypto.randomUUID(),
        offsetSec: 0,
      }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidResumeError, `${label}: 所属外trackはInvalidResumeError`);
      assert.equal(
        (error as Error).message,
        "resumeのPlaylistまたはTrackが作品に属していません",
        label,
      );
      return true;
    },
  );

  await assert.rejects(
    () => adapter.saveResume(workId, { playlistId: playlist.id, trackId: track.id, offsetSec: -1 }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidResumeError, `${label}: 負のoffsetSecはInvalidResumeError`);
      assert.equal((error as Error).message, "resumeのoffsetSecがトラック区間外です", label);
      return true;
    },
  );

  await assert.rejects(
    () =>
      adapter.saveResume(workId, {
        playlistId: playlist.id,
        trackId: track.id,
        offsetSec: track.durationSec! + 1,
      }),
    (error: unknown) => {
      assert.ok(
        error instanceof InvalidResumeError,
        `${label}: 区間外offsetSecはInvalidResumeError`,
      );
      assert.equal((error as Error).message, "resumeのoffsetSecがトラック区間外です", label);
      return true;
    },
  );

  assert.equal(
    await adapter.saveResume(workId, {
      playlistId: playlist.id,
      trackId: track.id,
      offsetSec: 0.5,
    }),
    true,
    `${label}: 正当なresumeは保存できる`,
  );
}

test("saveResume: 検証条件とエラーメッセージがreal/fixtureで一致する（fixture）", async () => {
  const adapter = fixtureResumeAdapter();
  await assertResumeContract(adapter, RESUME_WORK_ID, "fixture");
});

test("saveResume: 検証条件とエラーメッセージがreal/fixtureで一致する（real）", async (t) => {
  const { adapter, workId } = await realResumeAdapter(t);
  await assertResumeContract(adapter, workId, "real");
});

const DLSITE_APPLY_TAGS = nts(["genre/新ジャンル"]);
const DLSITE_APPLY_INFO: DlsiteWorkInfo = {
  rjCode: "RJ900099",
  title: "新タイトル",
  circle: null,
  cvs: [],
  genreTags: [],
  ageRating: null,
  coverUrl: null,
  url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900099.html",
};
const BASE_TAGS = nts(["cv/水瀬なずな", "サークル/夜想曲", "バイノーラル"]);

async function assertDlsiteApplyContract(adapter: DataAdapter, workId: string, label: string) {
  const snapshot = await adapter.getWorkEditSnapshot(workId);
  const result = await adapter.dlsiteApply(workId, {
    info: DLSITE_APPLY_INFO,
    applyTitle: true,
    applyTags: DLSITE_APPLY_TAGS,
    applyCover: false,
    applyUrl: true,
    sourceRevision: snapshot!.sourceRevision,
  });
  assert.ok(result, label);
  const work = await adapter.getWork(workId);
  assert.equal(work!.title, DLSITE_APPLY_INFO.title, label);
  assert.deepEqual(work!.tags, [...BASE_TAGS, ...DLSITE_APPLY_TAGS], label);
  assert.deepEqual(work!.urls, [{ label: "DLsite", url: DLSITE_APPLY_INFO.url }], label);
  assert.equal(work!.dlsite.rjCode, DLSITE_APPLY_INFO.rjCode, label);
  assert.equal(work!.dlsite.status, "applied", label);
  assert.deepEqual(work!.dlsite.appliedTags, DLSITE_APPLY_TAGS, label);
}

test("dlsiteApply: tags/title/urlのパッチ構築がreal/fixtureで一致する（fixture）", async () => {
  const workId = "dlsite-apply-contract-work";
  const adapter = createFixtureAdapter({
    works: [
      {
        id: workId,
        title: "旧タイトル",
        cover: null,
        status: "ok",
        physicalPath: "/library/dlsite-apply-contract-work",
        totalDurationSec: 0,
        addedAt: "2026-01-01T00:00:00.000Z",
        errorMessage: null,
        urls: [],
        tags: BASE_TAGS,
        trackCount: 0,
        bookmarked: false,
        lastPlayedAt: null,
        dlsite: {
          rjCode: null,
          status: "none",
          lastAttemptAt: null,
          error: null,
          errorKind: null,
          appliedTags: [],
        },
      },
    ],
  });
  await assertDlsiteApplyContract(adapter, workId, "fixture");
});

test("dlsiteApply: tags/title/urlのパッチ構築がreal/fixtureで一致する（real）", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = lib.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  await assertDlsiteApplyContract(adapter, lib.existingWorkId, "real");
});

async function assertAlreadyRegisteredContract(
  adapter: DataAdapter,
  path: string,
  expectedMessage: string,
  label: string,
) {
  await assert.rejects(
    () => adapter.createWork({ path: path as never, title: "重複登録", tags: [] }),
    (error: unknown) => {
      assert.ok(error instanceof WorkRegisterError, label);
      assert.equal((error as WorkRegisterError).code, "already_registered", label);
      assert.equal((error as WorkRegisterError).message, expectedMessage, label);
      return true;
    },
  );
}

async function assertDescendantsRegisteredContract(
  adapter: DataAdapter,
  path: string,
  label: string,
) {
  await assert.rejects(
    () => adapter.createWork({ path: path as never, title: "親作品", tags: [] }),
    (error: unknown) => {
      assert.ok(error instanceof WorkRegisterError, label);
      assert.equal((error as WorkRegisterError).code, "descendants_registered", label);
      return true;
    },
  );
}

test("createWork: 重複登録の拒否メッセージがreal/fixtureで一致する（フォルダー・fixture）", async () => {
  const adapter = createFixtureAdapter({
    works: [
      {
        id: "existing-folder-work",
        title: "既存作品",
        cover: null,
        status: "ok",
        physicalPath: "/library/existing-folder",
        totalDurationSec: 0,
        addedAt: "2026-01-01T00:00:00.000Z",
        errorMessage: null,
        urls: [],
        tags: [],
        trackCount: 0,
        bookmarked: false,
        lastPlayedAt: null,
        dlsite: {
          rjCode: null,
          status: "none",
          lastAttemptAt: null,
          error: null,
          errorKind: null,
          appliedTags: [],
        },
      },
    ],
  });
  await assertAlreadyRegisteredContract(
    adapter,
    "existing-folder",
    "このフォルダーは既に作品として登録されています",
    "fixture folder",
  );
});

test("createWork: 重複登録の拒否メッセージがreal/fixtureで一致する（フォルダー・real）", async (t) => {
  const dir = makeTestDirectory("register-dup-folder");
  t.after(dir.cleanup);
  const root = join(dir.path, "library");
  const workDir = join(root, "existing-folder");
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
  const adapter = dir.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: root });
  const scan = await adapter.scan();
  await adapter.registerScanCandidates(
    scan.candidates.map((candidate) => ({ path: candidate.path })),
  );
  await assertAlreadyRegisteredContract(
    adapter,
    "existing-folder",
    "このフォルダーは既に作品として登録されています",
    "real folder",
  );
});

test("createWork: 配下に登録済み作品がある親の登録拒否がreal/fixtureで一致する（fixture）", async () => {
  const adapter = createFixtureAdapter({
    works: [
      {
        id: "child-work",
        title: "子作品",
        cover: null,
        status: "ok",
        physicalPath: "/library/parent/child.wav",
        totalDurationSec: 1,
        addedAt: "2026-01-01T00:00:00.000Z",
        errorMessage: null,
        urls: [],
        tags: [],
        trackCount: 1,
        bookmarked: false,
        lastPlayedAt: null,
        dlsite: {
          rjCode: null,
          status: "none",
          lastAttemptAt: null,
          error: null,
          errorKind: null,
          appliedTags: [],
        },
      },
    ],
  });
  await assertDescendantsRegisteredContract(adapter, "parent", "fixture descendants");
});

test("createWork: 配下に登録済み作品がある親の登録拒否がreal/fixtureで一致する（real）", async (t) => {
  const dir = makeTestDirectory("register-dup-descendant");
  t.after(dir.cleanup);
  const root = join(dir.path, "library");
  const parent = join(root, "parent");
  const child = join(parent, "child");
  mkdirSync(child, { recursive: true });
  writeWav(join(parent, "intro.wav"), 1);
  writeWav(join(child, "track.wav"), 1);
  const adapter = dir.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: root });
  const childResult = await adapter.createWork({
    path: "parent/child" as never,
    title: "子作品",
    tags: [],
  });
  assert.ok(childResult, "real descendants setup");
  await assertDescendantsRegisteredContract(adapter, "parent", "real descendants");
});
