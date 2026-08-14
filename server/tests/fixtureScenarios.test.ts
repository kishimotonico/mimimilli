// fixture アダプタのシナリオ機能（ADR-0002 / client/mocks/scenarios.ts からの移植）のテスト。
import { test } from "node:test";
import assert from "node:assert/strict";
import { workspacePath } from "@mimimilli/shared";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import {
  createFixtureScenario,
  LARGE_SCENARIO_WORK_COUNT,
} from "../src/adapters/fixture/scenarios.ts";
import { resolveRegisteredRjCode } from "../src/adapters/fixture/settingsScan.ts";

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

test("new-work: スキャン結果に新規作品IDが含まれる", async () => {
  const app = buildApp("new-work");

  const started = await app.request("/api/scan", { method: "POST" });
  assert.equal(started.status, 202);
  const { job } = await started.json();
  let scanResult: { insertedWorkIds: string[] } | null = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const state = await app.request(`/api/scan/${job.id}`);
    const snapshot = await state.json();
    if (snapshot.status === "completed") {
      scanResult = snapshot.result;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(scanResult);
  assert.deepEqual(scanResult.insertedWorkIds, ["RJ501011", "RJ501001", "RJ501003"]);

  // 新規作品自体は works 一覧に存在する（スキャンで見つかった扱い）
  const worksRes = await app.request("/api/works");
  const { items } = await worksRes.json();
  const ids: string[] = items.map((w: { id: string }) => w.id);
  assert.ok(ids.includes("RJ501011"));
});

test("new-work: Files用診断とscan確認用の候補・問題を独立して返す", async () => {
  const adapter = createFixtureAdapter({ scenario: "new-work" });

  const result = await adapter.scan();
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.path),
    ["未登録作品", "朗読/候補"],
  );
  assert.deepEqual(result.identityConflicts[0]?.paths, ["viewer", "dlsite"]);
  assert.equal(result.invalidMetaFiles[0]?.path, "壊れた/mimimilli.json");
  assert.deepEqual((await adapter.listScanDiagnostics())[0]?.paths, [
    "dlsite/夜想曲スタジオ/RJ501001_夜更けの図書室で囁き朗読",
    "copies/RJ501001_夜更けの図書室で囁き朗読",
  ]);

  const registration = await adapter.registerScanCandidates([
    { path: workspacePath("未登録作品") },
    { path: workspacePath("消えた候補") },
  ]);
  assert.deepEqual(
    registration.registered.map((entry) => entry.path),
    ["未登録作品"],
  );
  assert.deepEqual(registration.failures, [
    { path: "消えた候補", message: "候補が見つかりません" },
  ]);

  // 候補承認はreal adapterのregisterCandidates（scanner.ts）と同じく、実際にcatalog
  // （fixtureではstate.works）へ行を増やす。新規登録済みタブはこのworksを介して
  // 承認分を表示するため、ここで見えなければタブにも出ない（TASK-328）。
  const registeredWorkId = registration.registered[0]?.workId;
  assert.ok(registeredWorkId);
  const registeredWorksPage = await adapter.queryWorks({
    q: "",
    tags: { tags: [], yearValue: null },
    tagOp: "AND",
    sort: "id-asc",
    ids: [registeredWorkId],
  });
  assert.equal(registeredWorksPage.items.length, 1);
  assert.equal(registeredWorksPage.items[0]?.title, "未登録作品");

  await adapter.excludeScanCandidates(["朗読/候補"]);
  assert.deepEqual(await adapter.listScanCandidates(), []);

  // 除外は可逆な扱い。restoreで戻すと一覧に復帰する（実装adapterは毎回ディスクを
  // 再走査するため自然に復帰するが、fixtureは静的リストを持つため個別に検証する）。
  await adapter.restoreScanCandidateExclusions(["朗読/候補"]);
  assert.deepEqual(
    (await adapter.listScanCandidates()).map((candidate) => candidate.path),
    ["朗読/候補"],
  );
});

test("fixture: rjCode省略・空文字・指定を区別する", () => {
  // 省略=候補が検出した値を採用、空文字=明示的になし（real adapterと同じく""のまま）、値=そのまま採用（候補登録APIの規約）。
  assert.equal(resolveRegisteredRjCode("RJ999999", undefined), "RJ999999");
  assert.equal(resolveRegisteredRjCode("RJ999999", ""), "");
  assert.equal(resolveRegisteredRjCode("RJ999999", "RJ111111"), "RJ111111");
  assert.equal(resolveRegisteredRjCode(null, undefined), null);
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
  await adapter.updateDlsiteState(workId, { rjCode: "RJ7654321" });

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

  const unchanged = await adapter.updateDlsiteState(workId, { rjCode: "RJ501001" });
  assert.equal(unchanged?.dlsite.status, "applied");
  assert.deepEqual(unchanged?.dlsite.appliedTags, before?.dlsite.appliedTags);

  const updated = await adapter.updateDlsiteState(workId, { rjCode: "RJ7654321" });
  assert.equal(updated?.dlsite.rjCode, "RJ7654321");
  assert.equal(updated?.dlsite.status, "none");
  assert.equal(updated?.dlsite.error, null);
  assert.equal(updated?.dlsite.errorKind, null);
  assert.deepEqual(updated?.dlsite.appliedTags, []);

  const bulk = await adapter.runDlsiteBulk("existing", [workId]);
  assert.equal(bulk.fetched, 1);
  assert.equal(bulk.skipped, 0);
});
