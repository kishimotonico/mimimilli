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
    workStatuses: new Map<string, "ok" | "missing">(),
    getWorkStatuses: async (ids: readonly string[]): Promise<Map<string, "ok" | "missing">> =>
      new Map([...state.workStatuses].filter(([id]) => ids.includes(id))),
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
    getWorkStatuses: (ids: readonly string[]) => state.getWorkStatuses(ids),
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
  (await session.listCandidates()).candidates.find((candidate) => candidate.path === path);

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
  assert.deepEqual(await session.listCandidates(), { scanCompleted: false, candidates: [] });
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
  assert.equal((await session.recordSnapshot()).finishedAt, "2026-01-01T00:00:00.000Z");
  const { scanCompleted, candidates } = await session.listCandidates();
  assert.equal(scanCompleted, true);
  assert.deepEqual(
    candidates.map((candidate) => candidate.path),
    ["A"],
  );
});

test("記録は読むときにcatalogと照合し、スキャン中に消えた作品を落とす", async () => {
  const { state, session } = stubMaterials();
  session.publish(
    {
      ...execution(["A"]),
      result: {
        ...RESULT,
        insertedWorkIds: ["gone", "kept"],
        updatedWorks: [
          { workId: "gone", changes: [{ kind: "meta" }] },
          { workId: "kept", changes: [{ kind: "meta" }] },
        ],
      },
    },
    "t",
  );
  state.workStatuses = new Map([["kept", "ok"]]);

  const record = await session.recordSnapshot();

  assert.deepEqual(
    record.updatedWorks.map((work) => work.workId),
    ["kept"],
  );
});

test("記録の照合中にスキャンが完了しても、読み始めた時点の記録で答え、新しい記録は漏れずに次の読みへ出る", async () => {
  const { state, session } = stubMaterials();
  const withUpdated = (workId: string, finishedAt: string): void =>
    session.publish(
      {
        ...execution(["A"]),
        result: { ...RESULT, updatedWorks: [{ workId, changes: [{ kind: "meta" }] }] },
      },
      finishedAt,
    );
  withUpdated("old", "t1");
  state.workStatuses = new Map([
    ["old", "ok"],
    ["new", "ok"],
  ]);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const enteredLookup = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const lookup = state.getWorkStatuses;
  state.getWorkStatuses = async (ids) => {
    entered();
    await gate;
    return lookup(ids);
  };

  const reading = session.recordSnapshot();
  await enteredLookup;
  withUpdated("new", "t2");
  release();
  const first = await reading;

  assert.equal(first.finishedAt, "t1");
  assert.deepEqual(
    first.updatedWorks.map((work) => work.workId),
    ["old"],
  );
  const second = await session.recordSnapshot();
  assert.equal(second.finishedAt, "t2");
  assert.deepEqual(
    second.updatedWorks.map((work) => work.workId),
    ["new"],
  );
});

test("scanCompleted が false のときは候補が空。同じrootの再設定は記録だけを捨て、候補のスキャンは完了したまま", async () => {
  const { session } = stubMaterials();
  session.publish(execution(["A", "B"]), "t1");

  session.beginRootReconfiguration(false);
  const afterReconfiguration = await session.listCandidates();
  assert.equal(afterReconfiguration.scanCompleted, true);
  assert.equal(afterReconfiguration.candidates.length, 2);
  assert.equal((await session.recordSnapshot()).finishedAt, null);

  session.beginRootReconfiguration(true);
  assert.deepEqual(await session.listCandidates(), { scanCompleted: false, candidates: [] });
  session.reset();
  assert.deepEqual(await session.listCandidates(), { scanCompleted: false, candidates: [] });
});

test("除外一覧のRJコードは、直した値、候補の検出値、プールに無いパスはフォルダー名から検出した値の順で返す", async () => {
  const { state, session } = stubMaterials();
  state.unavailable.add("RJ123456_未スキャン");
  assert.deepEqual(await session.listExclusions(), [
    { path: "RJ123456_未スキャン", rjCode: "RJ123456" },
  ]);

  session.publish(
    { ...execution([]), candidatePool: [folder("B", null), folder("RJ222222_C", "RJ222222")] },
    "t1",
  );
  await session.setRjCode("B", "RJ999999");
  state.unavailable.add("B");
  state.unavailable.add("RJ222222_C");
  state.unavailable.add("名前だけ");
  assert.deepEqual(await session.listExclusions(), [
    { path: "RJ123456_未スキャン", rjCode: "RJ123456" },
    { path: "B", rjCode: "RJ999999" },
    { path: "RJ222222_C", rjCode: "RJ222222" },
    { path: "名前だけ", rjCode: null },
  ]);
});
