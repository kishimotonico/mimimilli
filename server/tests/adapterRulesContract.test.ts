// resume検証・DLsite適用パッチ・登録重複チェックが real/fixture 両adapterで
// 同じ意味になることを縛る契約テスト。境界より手前のモックではなく、両adapterを
// DataAdapter インターフェース経由で実際に通して結果を比較する。
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { errorMessage, workspacePath } from "@mimimilli/shared";
import type { DataAdapter } from "../src/adapter/index.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { InvalidResumeError } from "../src/errors.ts";
import { WorkRegisterError } from "../src/errors.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { makeSampleLibrary, makeTestDirectory, writeWav } from "./helpers/sampleLibrary.ts";
import { nts } from "./helpers/tag.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../src/adapters/real/dlsiteConfig.ts";
import { applyFetchedDlsite, fetchDlsiteForWork } from "./helpers/dlsiteApply.ts";
import { htmlResponse, mockDlsiteTransport, sampleWorkHtml } from "./helpers/dlsiteTransport.ts";
import { buildFixtureAdapterWithCandidates } from "./helpers/fixtureCandidates.ts";
import { configureRoot } from "./helpers/rootFolder.ts";
import {
  NO_DLSITE,
  REGISTER_ALL,
  listCandidates,
  registerCandidates,
  runScan,
  setCandidateRjCode,
} from "./helpers/scanLibrary.ts";

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
        metaPath: "/library/resume-contract-work.mimimilli.json",
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
  await configureRoot(adapter, root);
  await runScan(adapter);
  const registration = await registerCandidates(
    adapter,
    (await listCandidates(adapter)).map((candidate) => candidate.path),
    REGISTER_ALL,
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
      assert.equal(errorMessage(error), "resumeのPlaylistまたはTrackが作品に属していません", label);
      return true;
    },
  );

  await assert.rejects(
    () => adapter.saveResume(workId, { playlistId: playlist.id, trackId: track.id, offsetSec: -1 }),
    (error: unknown) => {
      assert.ok(error instanceof InvalidResumeError, `${label}: 負のoffsetSecはInvalidResumeError`);
      assert.equal(errorMessage(error), "resumeのoffsetSecがトラック区間外です", label);
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
      assert.equal(errorMessage(error), "resumeのoffsetSecがトラック区間外です", label);
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

const DLSITE_APPLY_TAGS = nts(["genre/テスト"]);
const DLSITE_APPLY_RJ_CODE = "RJ900099";
const BASE_TAGS = nts(["cv/水瀬なずな", "サークル/夜想曲", "バイノーラル"]);

async function assertDlsiteApplyContract(adapter: DataAdapter, workId: string, label: string) {
  const fetched = await fetchDlsiteForWork(adapter, workId, DLSITE_APPLY_RJ_CODE);
  const result = await applyFetchedDlsite(adapter, workId, fetched, {
    title: true,
    url: true,
    tags: DLSITE_APPLY_TAGS,
  });
  assert.ok(result, label);
  const work = await adapter.getWork(workId);
  assert.equal(work!.title, fetched.info.title, label);
  assert.deepEqual(work!.tags, [...BASE_TAGS, ...DLSITE_APPLY_TAGS], label);
  assert.deepEqual(work!.urls, [{ label: "DLsite", url: fetched.info.url }], label);
  assert.equal(work!.dlsite.rjCode, DLSITE_APPLY_RJ_CODE, label);
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
        metaPath: "/library/dlsite-apply-contract-work/mimimilli.json",
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
  const adapter = lib.own(
    createTestRealAdapter({
      database: { kind: "memory" },
      dlsiteRequestConfig: {
        ...DEFAULT_DLSITE_REQUEST_CONFIG,
        requestIntervalMs: 0,
        retryCount: 0,
      },
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) =>
          htmlResponse(
            sampleWorkHtml(code, { title: `取得 ${code}`, genres: ["テスト"], cover: false }),
          ),
      }),
    }),
  );
  await configureRoot(adapter, lib.root);
  await runScan(adapter);
  await assertDlsiteApplyContract(adapter, lib.existingWorkId, "real");
});

async function assertAlreadyRegisteredContract(
  adapter: DataAdapter,
  path: string,
  expectedMessage: string,
  label: string,
) {
  await assert.rejects(
    () => adapter.createWork({ path: path as never, title: "重複登録", tags: [], ...NO_DLSITE }),
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
    () => adapter.createWork({ path: path as never, title: "親作品", tags: [], ...NO_DLSITE }),
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
        metaPath: "/library/existing-folder/mimimilli.json",
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
  await configureRoot(adapter, root);
  await runScan(adapter);
  await registerCandidates(
    adapter,
    (await listCandidates(adapter)).map((candidate) => candidate.path),
    REGISTER_ALL,
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
        metaPath: "/library/parent/child.mimimilli.json",
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
  await configureRoot(adapter, root);
  const childResult = await adapter.createWork({
    path: "parent/child" as never,
    title: "子作品",
    tags: [],
    ...NO_DLSITE,
  });
  assert.ok(childResult, "real descendants setup");
  await assertDescendantsRegisteredContract(adapter, "parent", "real descendants");
});

interface CandidateSubject {
  adapter: DataAdapter;
  pathA: string;
  pathB: string;
}

async function candidateSubject(
  kind: "fixture" | "real",
  t: TestContext,
): Promise<CandidateSubject> {
  if (kind === "fixture") {
    const folder = (path: string) => ({
      path: workspacePath(path),
      inferredTitle: path,
      audioFileCount: 1,
      audioBreakdown: [{ extension: "wav", count: 1 }],
      detectedRjCode: null,
    });
    const adapter = await buildFixtureAdapterWithCandidates([
      folder("候補A"),
      { ...folder("RJ123456_候補B"), detectedRjCode: "RJ123456" },
    ]);
    return { adapter, pathA: "候補A", pathB: "RJ123456_候補B" };
  }
  const dir = makeTestDirectory("candidate-override-contract");
  t.after(dir.cleanup);
  const root = join(dir.path, "library");
  for (const name of ["候補A", "RJ123456_候補B"]) {
    mkdirSync(join(root, name), { recursive: true });
    writeWav(join(root, name, "track.wav"), 1);
  }
  const adapter = dir.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await runScan(adapter);
  return { adapter, pathA: "候補A", pathB: "RJ123456_候補B" };
}

const rjCodeOf = async (adapter: DataAdapter, path: string) =>
  (await listCandidates(adapter)).find((candidate) => candidate.path === path);

for (const kind of ["fixture", "real"] as const) {
  test(`候補のRJコードの直しは、再スキャンしても候補に残る（${kind}）`, async (t) => {
    const { adapter, pathA, pathB } = await candidateSubject(kind, t);
    await setCandidateRjCode(adapter, pathA, "RJ999999");
    await setCandidateRjCode(adapter, pathB, null);

    await runScan(adapter);

    const a = await rjCodeOf(adapter, pathA);
    assert.equal(a?.rjCode, "RJ999999");
    assert.equal(a?.rjCodeEdited, true);
    const b = await rjCodeOf(adapter, pathB);
    assert.equal(b?.rjCode, null);
    assert.equal(b?.rjCodeEdited, true);
  });

  test(`候補から登録すると直しは消え、登録解除して候補に戻ると検出値で出る（${kind}）`, async (t) => {
    const { adapter, pathA } = await candidateSubject(kind, t);
    await setCandidateRjCode(adapter, pathA, "RJ999999");
    const { registered } = await registerCandidates(adapter, [pathA], REGISTER_ALL);
    assert.equal(registered.length, 1);
    assert.equal(await rjCodeOf(adapter, pathA), undefined);

    assert.equal(await adapter.deleteWork(registered[0]!.workId), true);
    await runScan(adapter);

    const back = await rjCodeOf(adapter, pathA);
    assert.equal(back?.rjCode, null);
    assert.equal(back?.rjCodeEdited, false);
  });

  test(`次のスキャン完了で候補プールから外れると直しは消え、戻っても検出値で出る（${kind}）`, async (t) => {
    const { adapter, pathA } = await candidateSubject(kind, t);
    await setCandidateRjCode(adapter, pathA, "RJ999999");
    const created = await adapter.createWork({
      path: pathA as never,
      title: "Files登録",
      tags: [],
      ...NO_DLSITE,
    });
    assert.ok(created);
    await runScan(adapter);
    assert.equal(await rjCodeOf(adapter, pathA), undefined);

    assert.equal(await adapter.deleteWork(created.snapshot.id), true);
    await runScan(adapter);

    const back = await rjCodeOf(adapter, pathA);
    assert.equal(back?.rjCode, null);
    assert.equal(back?.rjCodeEdited, false);
  });
}

for (const kind of ["fixture", "real"] as const) {
  test(`登録済み作品の配下のフォルダーは候補プールに入らない（${kind}）`, async (t) => {
    let adapter: DataAdapter;
    if (kind === "fixture") {
      const folder = (path: string) => ({
        path: workspacePath(path),
        inferredTitle: path,
        audioFileCount: 1,
        audioBreakdown: [{ extension: "wav", count: 1 }],
        detectedRjCode: null,
      });
      adapter = await buildFixtureAdapterWithCandidates([folder("親"), folder("親/子")]);
    } else {
      const dir = makeTestDirectory("candidate-pool-ancestor-contract");
      t.after(dir.cleanup);
      const root = join(dir.path, "library");
      mkdirSync(join(root, "親", "子"), { recursive: true });
      writeWav(join(root, "親", "子", "track.wav"), 1);
      adapter = dir.own(createTestRealAdapter({ database: { kind: "memory" } }));
      await configureRoot(adapter, root);
    }
    assert.ok((await adapter.scan()).candidatePool.length > 0);

    await adapter.createWork({ path: "親" as never, title: "親作品", tags: [], ...NO_DLSITE });

    assert.deepEqual((await adapter.scan()).candidatePool, []);
  });
}
