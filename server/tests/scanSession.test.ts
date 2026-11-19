import assert from "node:assert/strict";
import { test } from "node:test";
import { workspacePath, type ScanCandidateFolder, type ScanResult } from "@mimimilli/shared";
import type { DataAdapter, ScanExecution } from "../src/adapter/index.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { CandidatePoolChangedError } from "../src/errors.ts";
import { ScanJobManager } from "../src/scanJobManager.ts";
import { ScanSession } from "../src/scanSession.ts";
import { pollUntil } from "./helpers/poll.ts";
import { scanExecutionOf } from "./helpers/scanLibrary.ts";

const RESULT: ScanResult = {
  registered: 0,
  insertedWorkIds: [],
  startedWithEmptyCatalog: false,
  missingWorks: [],
  updatedWorks: [],
  errors: 0,
  missing: 0,
  skipped: 0,
  coverErrors: 0,
  unreadablePaths: [],
};

const folder = (path: string, detectedRjCode: string | null = null): ScanCandidateFolder => ({
  path: workspacePath(path),
  inferredTitle: path,
  audioFileCount: 1,
  audioBreakdown: [{ extension: "wav", count: 1 }],
  detectedRjCode,
});

function execution(paths: string[], rootIdentity = "/library"): ScanExecution {
  return {
    ...scanExecutionOf(RESULT),
    candidatePool: paths.map((path) => folder(path)),
    rootIdentity,
  };
}

/** 規則だけを確かめるための素材。除外と登録済みは呼び出し側が操作する */
function stubMaterials() {
  const state = {
    rootIdentity: "/library" as string | null,
    unavailable: new Set<string>(),
    registerGate: null as Promise<void> | null,
    onRegisterEntered: (): void => {},
    registered: [] as string[],
  };
  const adapter = {
    candidateRootIdentity: async () => state.rootIdentity,
    candidateAvailability: async () => (f: ScanCandidateFolder) => !state.unavailable.has(f.path),
    describeCandidates: async () => () => ({
      dlsite: { state: "none" as const },
      missingWorks: [],
    }),
    registerCandidateFolder: async (f: ScanCandidateFolder) => {
      state.onRegisterEntered();
      await state.registerGate;
      state.registered.push(f.path);
      return { workId: `work-${f.path}`, coverSkipped: null };
    },
    excludeScanCandidates: async (paths: string[]) => {
      for (const path of paths) state.unavailable.add(path);
    },
    listScanCandidateExclusions: async () => [...state.unavailable],
    restoreScanCandidateExclusions: async (paths: string[]) => {
      for (const path of paths) state.unavailable.delete(path);
    },
  };
  return { state, session: new ScanSession(adapter) };
}

const ALL = { title: true, cover: true, tags: true, url: true };
const find = async (session: ScanSession, path: string) =>
  (await session.listCandidates()).find((candidate) => candidate.path === path);

test("直したRJコード（なしの明示を含む）は、同じフォルダーを含む次のスキャンの完了後も残る", async () => {
  const { session } = stubMaterials();
  const pool = (): ScanExecution => ({
    ...execution(["A"]),
    candidatePool: [folder("A"), folder("B", "RJ100000")],
  });
  session.publish(pool(), "t1");
  await session.setRjCode("A", "RJ111111");
  await session.setRjCode("B", null);

  session.publish(pool(), "t2");

  assert.deepEqual(
    [await find(session, "A"), await find(session, "B")].map((c) => [c?.rjCode, c?.rjCodeEdited]),
    [
      ["RJ111111", true],
      [null, true],
    ],
  );
});

test("スキャン実行中に直したRJコードは、完了後も残る", async () => {
  const state = { release: (): void => {} };
  const fixture = createFixtureAdapter();
  const adapter: DataAdapter = {
    ...fixture,
    scan: () =>
      new Promise<ScanExecution>((resolve) => {
        state.release = () => resolve(execution(["A"]));
      }),
  };
  const session = new ScanSession(adapter);
  session.publish(execution(["A"]), "t0");
  const manager = new ScanJobManager(adapter, { session });
  const job = manager.start();
  await pollUntil(async () => manager.get(job.id)?.status === "running");

  await session.setRjCode("A", "RJ222222");
  state.release();
  await pollUntil(async () => manager.get(job.id)?.status === "completed");

  assert.equal((await find(session, "A"))?.rjCode, "RJ222222");
});

test("候補から登録すると直しが消える。登録中にスキャンが完了しても消える", async () => {
  const { state, session } = stubMaterials();
  session.publish(execution(["A"]), "t1");
  await session.setRjCode("A", "RJ333333");
  let release!: () => void;
  state.registerGate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const entered = new Promise<void>((resolve) => {
    state.onRegisterEntered = resolve;
  });
  const registering = session.registerCandidates(["A"], ALL);
  await entered;
  session.publish(execution(["A"]), "t2");
  release();
  const { registered } = await registering;
  assert.equal(registered.length, 1);

  state.unavailable.clear();
  const back = await find(session, "A");
  assert.equal(back?.rjCode, null);
  assert.equal(back?.rjCodeEdited, false);
});

test("次のスキャン完了で候補のプールから外れると直しが消える", async () => {
  const { session } = stubMaterials();
  session.publish(execution(["A"]), "t1");
  await session.setRjCode("A", "RJ444444");

  session.publish(execution([]), "t2");
  session.publish(execution(["A"]), "t3");

  const back = await find(session, "A");
  assert.equal(back?.rjCode, null);
  assert.equal(back?.rjCodeEdited, false);
});

test("除外では直しが消えず、除外解除で直した値のまま戻る", async () => {
  const { session } = stubMaterials();
  session.publish(execution(["A"]), "t1");
  await session.setRjCode("A", "RJ555555");

  await session.excludeCandidates(["A"]);
  session.publish(execution(["A"]), "t2");
  assert.equal(await find(session, "A"), undefined);
  await session.restoreExclusions(["A"]);

  assert.equal((await find(session, "A"))?.rjCode, "RJ555555");
});

test("rootが変わる再設定では候補と直しを捨て、同じrootの再設定では直しを残す", async () => {
  const { session } = stubMaterials();
  session.publish(execution(["A"]), "t1");
  await session.setRjCode("A", "RJ666666");

  session.beginRootReconfiguration(false);
  assert.equal((await find(session, "A"))?.rjCode, "RJ666666");

  session.beginRootReconfiguration(true);
  assert.deepEqual(await session.listCandidates(), []);
  session.publish(execution(["A"]), "t2");
  assert.equal((await find(session, "A"))?.rjCode, null);
});

test("公開したrootと現在のrootが違うと、候補の操作は CandidatePoolChangedError になる", async () => {
  const { state, session } = stubMaterials();
  session.publish(execution(["A"]), "t1");
  state.rootIdentity = "/other";

  await assert.rejects(() => session.setRjCode("A", "RJ777777"), CandidatePoolChangedError);
  await assert.rejects(() => session.registerCandidates(["A"], ALL), CandidatePoolChangedError);
  await assert.rejects(() => session.excludeCandidates(["A"]), CandidatePoolChangedError);
});

test("公開でプールと記録がまとめて差し替わる", async () => {
  const { session } = stubMaterials();
  session.publish(execution(["A"]), "2026-01-01T00:00:00.000Z");
  assert.equal(session.record.snapshot().finishedAt, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(
    (await session.listCandidates()).map((candidate) => candidate.path),
    ["A"],
  );
});
