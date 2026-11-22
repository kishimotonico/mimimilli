import {
  NO_DLSITE,
  REGISTER_ALL,
  excludeCandidates,
  listCandidates,
  registerCandidates,
  runScan,
} from "./helpers/scanLibrary.ts";
// fixture アダプタのシナリオ機能（ADR-0002 / client/mocks/scenarios.ts からの移植）のテスト。
import { test } from "node:test";
import assert from "node:assert/strict";
import { workspacePath } from "@mimimilli/shared";
import { createApp } from "./helpers/testApp.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { CandidatePoolChangedError } from "../src/errors.ts";
import {
  createFixtureScenario,
  LARGE_SCENARIO_WORK_COUNT,
  SCENARIO_IDS,
} from "../src/adapters/fixture/scenarios.ts";
import { createWorkMethods } from "../src/adapters/fixture/works.ts";
import { createSettingsScanMethods } from "../src/adapters/fixture/settingsScan.ts";
import { createInitialState } from "../src/adapters/fixture/state.ts";
import type { ScanCandidateFolder } from "@mimimilli/shared";
import { buildFixtureAdapterWithCandidates } from "./helpers/fixtureCandidates.ts";
import { configureRoot } from "./helpers/rootFolder.ts";

/** createFixtureAdapter同様の合成だが、候補一覧だけを差し替えられる（候補登録の契約テスト用） */
function buildApp(scenario?: string) {
  return createApp(createFixtureAdapter({ scenario }));
}

test("シナリオ省略時は default として動作する", async () => {
  const app = buildApp();
  const res = await app.request("/api/works");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.items.length > 0);
});

test("new-work: スキャン結果に新規作品・読み取れなかったパスが含まれ、行方不明は診断に出る", async () => {
  const adapter = createFixtureAdapter({ scenario: "new-work" });

  const first = await runScan(adapter);
  assert.equal(first.startedWithEmptyCatalog, false);
  assert.deepEqual(first.insertedWorkIds, ["RJ501011", "RJ501001", "RJ501003"]);
  const diagnostics = await adapter.listScanDiagnostics();
  assert.deepEqual(
    diagnostics.missingWorks.map((work) => work.workId),
    ["RJ501008", "RJ501010"],
  );
  assert.equal(
    diagnostics.missingWorks[0]?.title,
    "ツンデレ後輩との放課後トレーニング【ボイスドラマ】",
  );
  assert.equal(
    diagnostics.missingWorks[0]?.previousPath,
    "dlsite/月白製作所/RJ501008_ツンデレ後輩との放課後トレーニング",
  );
  assert.deepEqual(first.unreadablePaths, ["権限なし/フォルダー"]);
  assert.equal((await adapter.getWork("RJ501008"))?.status, "missing");

  // 今回の変化は最初のスキャンだけ。行方不明とアクセス不可は直るまで残る
  const second = await runScan(adapter);
  assert.deepEqual(second.insertedWorkIds, []);
  assert.deepEqual(second.updatedWorks, []);
  assert.deepEqual(second.unreadablePaths, ["権限なし/フォルダー"]);
  assert.deepEqual(
    (await adapter.listScanDiagnostics()).missingWorks.map((work) => work.workId),
    ["RJ501008", "RJ501010"],
  );

  // 新規作品自体は works 一覧に存在する（スキャンで見つかった扱い）
  assert.ok(await adapter.getWork("RJ501011"));
});

test("empty: 作品が1件もない状態で始めたスキャンは startedWithEmptyCatalog になる", async () => {
  const adapter = createFixtureAdapter({ scenario: "empty" });
  assert.equal((await runScan(adapter)).startedWithEmptyCatalog, true);
});

test("new-work: Files用診断とscan確認用の候補・問題を独立して返す", async () => {
  const adapter = createFixtureAdapter({ scenario: "new-work" });

  await runScan(adapter);
  assert.deepEqual(
    (await listCandidates(adapter)).map((candidate) => candidate.path),
    ["未登録作品", "朗読/候補"],
  );
  const diagnostics = await adapter.listScanDiagnostics();
  assert.equal(diagnostics.invalidMetaFiles[0]?.path, "壊れた/mimimilli.json");
  assert.deepEqual(diagnostics.identityConflicts[0]?.paths, [
    "dlsite/夜想曲スタジオ/RJ501001_夜更けの図書室で囁き朗読",
    "copies/RJ501001_夜更けの図書室で囁き朗読",
  ]);

  await assert.rejects(
    () =>
      registerCandidates(
        adapter,
        [workspacePath("未登録作品"), workspacePath("消えた候補")],
        REGISTER_ALL,
      ),
    CandidatePoolChangedError,
  );
  assert.equal(
    (await listCandidates(adapter)).some((candidate) => candidate.path === "未登録作品"),
    true,
  );

  const registration = await registerCandidates(
    adapter,
    [workspacePath("未登録作品")],
    REGISTER_ALL,
  );
  assert.deepEqual(
    registration.registered.map((entry) => entry.path),
    ["未登録作品"],
  );
  assert.deepEqual(registration.failures, []);

  // 候補承認はreal adapterのregisterCandidates（scanner.ts）と同じく、実際にcatalog
  // （fixtureではstate.works）へ行を増やす。新規登録済みタブはこのworksを介して
  // 承認分を表示するため、ここで見えなければタブにも出ない。
  const registeredWorkId = registration.registered[0]?.workId;
  assert.ok(registeredWorkId);
  const registeredWorksPage = await adapter.queryWorksLegacy({
    q: "",
    tags: { tags: [], yearValue: null },
    tagOp: "AND",
    sort: "id-asc",
    ids: [registeredWorkId],
  });
  assert.equal(registeredWorksPage.items.length, 1);
  assert.equal(registeredWorksPage.items[0]?.title, "未登録作品");

  await excludeCandidates(adapter, ["朗読/候補"]);
  assert.deepEqual(await listCandidates(adapter), []);
  await assert.rejects(
    () => registerCandidates(adapter, [workspacePath("朗読/候補")], REGISTER_ALL),
    CandidatePoolChangedError,
  );

  // 除外は可逆な扱い。restoreで戻すと一覧に復帰する（実装adapterは毎回ディスクを
  // 再走査するため自然に復帰するが、fixtureは静的リストを持つため個別に検証する）。
  await adapter.restoreScanCandidateExclusions(["朗読/候補"]);
  assert.deepEqual(
    (await listCandidates(adapter)).map((candidate) => candidate.path),
    ["朗読/候補"],
  );
});

test("new-work: identityConflicts・invalidMetaFilesが指すパスは/fsツリー上に実在する", async () => {
  const app = buildApp("new-work");

  const canonical = await app.request(
    "/api/fs?path=dlsite/夜想曲スタジオ/RJ501001_夜更けの図書室で囁き朗読",
  );
  assert.equal(canonical.status, 200);
  assert.equal((await canonical.json()).workId, "RJ501001");

  // identityConflictsの重複コピー側も/fsツリーに実体があり200で返る必要がある
  const duplicate = await app.request("/api/fs?path=copies/RJ501001_夜更けの図書室で囁き朗読");
  assert.equal(duplicate.status, 200);
  const duplicateBody = await duplicate.json();
  assert.equal(duplicateBody.workId, "RJ501001");
  assert.ok(duplicateBody.entries.length > 0);

  // invalidMetaFiles側の"壊れた/mimimilli.json"（invalidMetaFiles）も同種の不整合
  const metaFileDir = await app.request("/api/fs?path=壊れた");
  assert.equal(metaFileDir.status, 200);
  const metaEntry = (await metaFileDir.json()).entries.find(
    (entry: { name: string }) => entry.name === "mimimilli.json",
  );
  assert.ok(metaEntry, "壊れた/mimimilli.json が/fsツリーに存在しない");
});

test("identity-conflict: 単一ファイル形式の重複メタファイルと音声ファイルがrealと同じ配置で/fsツリーに載る", async () => {
  const app = buildApp("identity-conflict");
  const entries = async (path: string) =>
    (await (await app.request(`/api/fs?path=${path}`)).json()).entries as Array<{
      name: string;
      workId: string | null;
    }>;

  assert.deepEqual(
    (await entries("fanza")).map(({ name, workId }) => ({ name, workId })),
    [
      { name: "d00001.mp3", workId: null },
      { name: "d00002.mp3", workId: "d00002" },
      { name: "d00002.mimimilli.json", workId: null },
    ],
  );
  assert.deepEqual(
    (await entries("copies")).map(({ name, workId }) => ({ name, workId })),
    [
      { name: "d00002.mimimilli.json", workId: null },
      { name: "d00002.mp3", workId: null },
    ],
  );

  const diagnostics = await (await app.request("/api/scan/diagnostics")).json();
  assert.deepEqual(diagnostics.identityConflicts, [
    {
      kind: "identity_conflict",
      registeredTitle: "FANZA単一ファイル作品（ID重複）",
      registeredPath: "fanza/d00002.mimimilli.json",
      workId: "d00002",
      paths: ["fanza/d00002.mimimilli.json", "copies/d00002.mimimilli.json"],
    },
  ]);
});

test("errors: データ不整合は診断・エクスポートから取得できる", async () => {
  // 劣化状態を確認するためのシナリオ errors に置く。new-work・default等の既定シナリオへ置くと
  // smoke・worktree確認の土台が常時バナー込みになってしまうため避ける
  const adapter = createFixtureAdapter({ scenario: "errors" });

  const diagnostics = await adapter.listScanDiagnostics();
  assert.deepEqual(diagnostics.dataIntegrityWorks, [
    { workId: "RJ501099", title: "タグの値が壊れた作品" },
  ]);

  const exported = await adapter.exportLibrary();
  assert.deepEqual(exported.dataIntegrityWarning, {
    skippedCount: 1,
    skippedWorkIds: ["RJ501099"],
  });
});

test("new-work・default: データ不整合は無い", async () => {
  for (const scenario of [undefined, "new-work"] as const) {
    const adapter = createFixtureAdapter({ scenario });
    assert.deepEqual(
      (await adapter.listScanDiagnostics()).dataIntegrityWorks,
      [],
      `scenario=${scenario ?? "default"}`,
    );
  }
});

test("候補登録APIは、サーバーが持つ実効RJコード（検出値・直した値・なしの明示）で登録する", async () => {
  const folder = (path: string, detectedRjCode: string | null): ScanCandidateFolder => ({
    path: workspacePath(path),
    inferredTitle: path,
    audioFileCount: 1,
    audioBreakdown: [{ extension: "wav", count: 1 }],
    detectedRjCode,
  });
  const app = createApp(
    await buildFixtureAdapterWithCandidates([
      folder("自動検出済み", "RJ700001"),
      folder("明示なし", "RJ700002"),
      folder("値指定", null),
      folder("検出なし", null),
    ]),
  );
  try {
    const setRjCode = async (path: string, rjCode: string) => {
      const response = await app.request("/api/scan/candidates/rj-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, rjCode }),
      });
      assert.equal(response.status, 200);
    };
    await setRjCode("明示なし", "");
    await setRjCode("値指定", "rj1234567");
    const response = await app.request("/api/scan/candidates/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paths: ["自動検出済み", "明示なし", "値指定", "検出なし"],
        apply: { title: true, cover: true, tags: true, url: true },
      }),
    });
    assert.equal(response.status, 201);
    const { registered } = await response.json();
    const workIdByPath = new Map<string, string>(
      registered.map((entry: { path: string; workId: string }) => [entry.path, entry.workId]),
    );

    const rjCodeOf = async (path: string) => {
      const workId = workIdByPath.get(path);
      assert.ok(workId, `${path}が登録されていません`);
      const detail = await app.request(`/api/works/${workId}`);
      assert.equal(detail.status, 200);
      return (await detail.json()).dlsite.rjCode;
    };
    assert.equal(await rjCodeOf("自動検出済み"), "RJ700001");
    assert.equal(await rjCodeOf("明示なし"), "");
    assert.equal(await rjCodeOf("値指定"), "RJ1234567");
    assert.equal(await rjCodeOf("検出なし"), null);
  } finally {
    await app.shutdown();
  }
});

test("empty: 作品・スマートフォルダーが0件", async () => {
  const app = buildApp("empty");

  const worksRes = await app.request("/api/works");
  const worksBody = await worksRes.json();
  assert.equal(worksBody.total, 0);
  assert.deepEqual(worksBody.items, []);

  const smartFoldersRes = await app.request("/api/smart-folders");
  assert.deepEqual(await smartFoldersRes.json(), []);
});

test("errors: エラー・行方不明の作品のみが含まれる", async () => {
  const app = buildApp("errors");

  const res = await app.request("/api/works");
  const { items } = await res.json();
  assert.ok(items.length > 0);
  for (const work of items) {
    assert.notEqual(work.status, "ok");
  }
  const statuses = new Set(items.map((w: { status: string }) => w.status));
  assert.ok(statuses.has("error") || statuses.has("missing"));
});

test("identity-conflict-unregistered: 登録済みの作品が無いID重複は、再採番で新しい作品として取り込め、診断が消える", async () => {
  const app = buildApp("identity-conflict-unregistered");
  const before = await (await app.request("/api/scan/diagnostics")).json();
  assert.deepEqual(before.identityConflicts, [
    {
      kind: "identity_conflict",
      workId: "unregistered-id",
      paths: ["copies/first-copy", "copies/second-copy"],
      registeredTitle: null,
      registeredPath: null,
    },
  ]);

  const res = await app.request("/api/works/identity-conflicts/reassign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "copies/first-copy" }),
  });
  assert.equal(res.status, 201);
  const { snapshot } = await res.json();
  assert.notEqual(snapshot.id, "unregistered-id");
  assert.equal(snapshot.title, "first-copy");
  assert.equal((await app.request(`/api/works/${snapshot.id}`)).status, 200);

  const after = await (await app.request("/api/scan/diagnostics")).json();
  assert.deepEqual(after.identityConflicts, []);
});

test("全シナリオ: rootFolderが作品のphysicalPathの前方一致になっている（relativeToRootが正しく剥がせる前提）", () => {
  // シナリオ追加・rootFolder変更のたびに手作業で気をつける前提を無くすため、
  // 個別シナリオではなくSCENARIO_IDS全件をループする。
  for (const id of SCENARIO_IDS) {
    const scenario = createFixtureScenario(id, "2026-08-11T00:00:00.000Z");
    if (scenario.works.length === 0) continue; // 例: empty
    for (const work of scenario.works) {
      assert.ok(
        work.physicalPath.startsWith(scenario.rootFolder ?? ""),
        `[${id}] ${work.physicalPath} が rootFolder(${scenario.rootFolder}) 配下ではない`,
      );
    }
  }
});

test("large: 1000件の作品が生成され、IDが一意でスキーマ検証を通る", async () => {
  const app = buildApp("large");

  const pages = await Promise.all(
    [1, 2].map(async (page) => {
      const res = await app.request(`/api/works?limit=500&page=${page}`);
      assert.equal(res.status, 200);
      return res.json();
    }),
  );
  const ids = pages.flatMap((page) => page.items.map((w: { id: string }) => w.id));
  assert.equal(pages[0].total, LARGE_SCENARIO_WORK_COUNT);
  assert.equal(ids.length, LARGE_SCENARIO_WORK_COUNT);
  assert.equal(new Set(ids).size, LARGE_SCENARIO_WORK_COUNT);

  // 手書きシードも先頭に含まれ、詳細取得まで通る（合成メディアの参照元が壊れていない）
  const detail = await app.request("/api/works/RJ600500");
  assert.equal(detail.status, 200);
});

test("large: 生成直後のDLsite取得失敗が未失効で反映される（not_found/error）", async () => {
  const app = buildApp("large");

  const pages = await Promise.all(
    [1, 2].map(async (page) => {
      const res = await app.request(`/api/works?limit=500&page=${page}`);
      assert.equal(res.status, 200);
      return res.json() as Promise<{ items: Array<{ dlsite: { status: string } }> }>;
    }),
  );
  const items = pages.flatMap((page) => page.items);
  const failed = items.filter(
    (w) => w.dlsite.status === "not_found" || w.dlsite.status === "error",
  );
  assert.ok(failed.length > 0);
});

test("large: 生成データが決定的（同じシナリオを2回作っても同一）", () => {
  const first = createFixtureScenario("large", "2026-08-11T00:00:00.000Z");
  const second = createFixtureScenario("large", "2026-08-11T00:00:00.000Z");
  assert.deepEqual(first.works, second.works);
});

test("不明なシナリオIDはエラーになる（黙って default にフォールバックしない）", () => {
  assert.throws(
    () => createFixtureAdapter({ scenario: "no-such-scenario" }),
    /不明な MIMIMILLI_MOCK_SCENARIO/,
  );
});

test("register-preview: ルート境界の前方一致だけでは配下扱いしない", async () => {
  const app = buildApp();
  const res = await app.request("/api/works/register-preview?path=/library2/foo");
  assert.equal(res.status, 400);
});

test("fixtureのDLsite取得は保存済みRJコードの修正を反映する", async () => {
  const adapter = createFixtureAdapter();
  const workId = "RJ501001";
  await adapter.updateDlsiteState(workId, {
    sourceRevision: (await adapter.getWorkEditSnapshot(workId))!.sourceRevision,
    rjCode: "RJ7654321",
  });

  const result = await adapter.dlsiteFetch(workId);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.info.rjCode, "RJ7654321");
  assert.equal(result.info.title, "（fixture）RJ7654321");
  assert.match(result.info.url, /RJ7654321\.html$/);
});

test("fixture: RJコード変更で旧状態をリセットし一括取得対象に戻す", async () => {
  const adapter = createFixtureAdapter();
  const workId = "RJ501001";
  const before = await adapter.getWork(workId);
  assert.equal(before?.dlsite.status, "applied");
  assert.ok((before?.dlsite.appliedTags.length ?? 0) > 0);

  const unchanged = await adapter.updateDlsiteState(workId, {
    sourceRevision: (await adapter.getWorkEditSnapshot(workId))!.sourceRevision,
    rjCode: "RJ501001",
  });
  assert.equal(unchanged?.snapshot.dlsite.status, "applied");
  assert.deepEqual(unchanged?.snapshot.dlsite.appliedTags, before?.dlsite.appliedTags);

  const updated = await adapter.updateDlsiteState(workId, {
    sourceRevision: (await adapter.getWorkEditSnapshot(workId))!.sourceRevision,
    rjCode: "RJ7654321",
  });
  assert.equal(updated?.snapshot.dlsite.rjCode, "RJ7654321");
  assert.equal(updated?.snapshot.dlsite.status, "none");
  assert.deepEqual(updated?.snapshot.dlsite.appliedTags, []);

  assert.equal((await adapter.fetchDlsiteProduct("RJ7654321", { force: false })).state, "fetched");
});

test("fixture: 単一音声ファイルのregister-previewと登録ができる", async () => {
  const app = buildApp();
  const previewRes = await app.request("/api/works/register-preview?path=fanza/d00001.mp3");
  assert.equal(previewRes.status, 200);
  const preview = await previewRes.json();
  assert.equal(preview.suggestedTitle, "d00001");
  assert.equal(preview.alreadyRegistered, false);
  assert.equal(preview.descendantWorkCount, 0);

  const created = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "fanza/d00001.mp3", title: "FANZA単一ファイル", ...NO_DLSITE }),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.snapshot.title, "FANZA単一ファイル");
  assert.ok(createdBody.snapshot.physicalPath.endsWith("/fanza/d00001.mp3"));
  assert.equal(createdBody.projection.status, "published");
  const workRes = await app.request(`/api/works/${createdBody.snapshot.id}`);
  assert.equal(workRes.status, 200);
  const work = await workRes.json();
  assert.equal(work.playlists[0].tracks.length, 1);
  assert.equal(work.playlists[0].tracks[0].file, "d00001.mp3");

  const listing = await app.request("/api/fs?path=fanza");
  assert.equal(listing.status, 200);
  const file = (await listing.json()).entries.find(
    (entry: { name: string }) => entry.name === "d00001.mp3",
  );
  assert.equal(file?.workId, createdBody.snapshot.id);
  assert.equal(file?.workRelPath, "");

  const again = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "fanza/d00001.mp3", title: "再登録", ...NO_DLSITE }),
  });
  assert.equal(again.status, 409);
});

test("fixture: 異なるrootへの変更で候補除外を破棄し、同一rootの再保存では破棄しない", async () => {
  const state = createInitialState({ scenario: "empty" });
  const methods = { ...createSettingsScanMethods(state), ...createWorkMethods(state) };
  const { excludeScanCandidates, listScanCandidateExclusions } = methods;

  await configureRoot(methods, "/library/root-a");
  await excludeScanCandidates(["候補"]);
  assert.deepEqual(await listScanCandidateExclusions(), ["候補"]);

  await configureRoot(methods, "/library/root-a");
  assert.deepEqual(await listScanCandidateExclusions(), ["候補"]);

  await configureRoot(methods, "/library/root-b");
  assert.deepEqual(await listScanCandidateExclusions(), []);
});

test("fixture: 異なるrootへの変更で候補プールを破棄し、次のscanで作り直す", async () => {
  const adapter = createFixtureAdapter({ scenario: "new-work" });
  const paths = async () => (await listCandidates(adapter)).map((c) => c.path);
  assert.deepEqual(await paths(), []);
  await runScan(adapter);
  assert.deepEqual(await paths(), ["未登録作品", "朗読/候補"]);

  await configureRoot(adapter, "/library/root-b");
  assert.deepEqual(await paths(), []);

  await runScan(adapter);
  assert.deepEqual(
    (await listCandidates(adapter)).map((c) => c.path),
    ["未登録作品", "朗読/候補"],
  );
  assert.deepEqual(await paths(), ["未登録作品", "朗読/候補"]);
});

test("scan-review: 候補が取得状態ごとの表示になり、直した行だけ rjCodeEdited になる", async () => {
  const adapter = createFixtureAdapter({ scenario: "scan-review" });
  await runScan(adapter);
  const app = createApp(adapter);
  try {
    const list = async () => {
      const response = await app.request("/api/scan/candidates");
      assert.equal(response.status, 200);
      const { candidates } = await response.json();
      return new Map<string, { rjCode: string | null; rjCodeEdited: boolean; dlsite: unknown }>(
        candidates.map((entry: { rjCode: string | null }) => [entry.rjCode ?? "", entry as never]),
      );
    };
    const before = await list();
    assert.ok(before.has("RJ000402") && before.has("RJ000403") && before.has("RJ000404"));
    assert.ok(before.has(""), "RJコードなしの候補がある");
    assert.ok([...before.values()].every((entry) => !entry.rjCodeEdited));

    const fetchCodes = async (productCodes: string[]) => {
      const response = await app.request("/api/dlsite/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productCodes }),
      });
      assert.equal(response.status, 202);
    };
    await fetchCodes(["RJ000401", "RJ000402", "RJ000403", "RJ000404"]);
    for (let i = 0; i < 100; i++) {
      const response = await app.request("/api/dlsite/jobs/current");
      const { job } = (await response.json()) as { job: { status: string } | null };
      if (job?.status === "finished") break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const after = await list();
    const stateOf = (code: string) => (after.get(code)!.dlsite as { state: string }).state;
    assert.equal(stateOf("RJ000401"), "fetched");
    assert.equal(stateOf("RJ000402"), "fetched");
    assert.equal((after.get("RJ000402")!.dlsite as { cover: unknown }).cover, null);
    assert.notEqual((after.get("RJ000401")!.dlsite as { cover: unknown }).cover, null);
    assert.equal(stateOf("RJ000403"), "not_found");
    assert.equal(stateOf("RJ000404"), "failed");

    const edited = await app.request("/api/scan/candidates/rj-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "RJ000405_夜更けの朗読", rjCode: "" }),
    });
    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).candidate.rjCodeEdited, true);
    assert.equal((await list()).get("")?.rjCodeEdited, true);
  } finally {
    await app.shutdown();
  }
});

test("needs-attention: スキャン後に要対応の5種類が揃い、読み直しと登録解除で消える", async () => {
  const adapter = createFixtureAdapter({ scenario: "needs-attention" });

  const result = await runScan(adapter);
  assert.deepEqual(result.unreadablePaths, [workspacePath("権限なし/フォルダー")]);

  const diagnostics = await adapter.listScanDiagnostics();
  assert.deepEqual(
    diagnostics.missingWorks.map((work) => work.workId),
    ["RJ501008", "RJ501010"],
  );
  assert.deepEqual(diagnostics.unreadablePaths, ["権限なし/フォルダー"]);
  assert.deepEqual(diagnostics.dataIntegrityWorks, [
    { workId: "RJ501099", title: "タグの値が壊れた作品" },
  ]);
  assert.equal(diagnostics.identityConflicts.length, 1);
  assert.deepEqual(
    diagnostics.invalidMetaFiles.map((file) => file.message),
    ["mimimilli.json 4行目: カンマが足りない"],
  );

  assert.equal(await adapter.reloadWork("RJ501099"), true);
  assert.deepEqual((await adapter.listScanDiagnostics()).dataIntegrityWorks, []);
});
