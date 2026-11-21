// GET /works の scanRecord 絞り込みと、登録解除した作品を記録が読むときに落とすこと（worksRoute・adapter・ScanRecordStore の結線）。
import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { workspacePath, type ScanResult } from "@mimimilli/shared";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { worksRoute } from "../src/routes/works.ts";
import type { DataAdapter } from "../src/adapter/index.ts";
import { ScanRecordStore } from "../src/scanRecord.ts";
import { runScan } from "./helpers/scanLibrary.ts";

function result(overrides: Partial<ScanResult>): ScanResult {
  return {
    registered: 0,
    insertedWorkIds: [],
    startedWithEmptyCatalog: false,
    updatedWorks: [],
    errors: 0,
    missing: 0,
    skipped: 0,
    coverErrors: 0,
    unreadablePaths: [],
    ...overrides,
  };
}

/** 記録を読むときの照合（ScanSession.recordSnapshot と同じ） */
async function snapshotOf(adapter: DataAdapter, store: ScanRecordStore) {
  return store.snapshot(await adapter.getWorkStatuses(store.snapshotWorkIds()));
}

function setup() {
  const adapter = createFixtureAdapter();
  const store = new ScanRecordStore();
  const app = new Hono().route("/api", worksRoute(adapter, store));
  return { adapter, store, app };
}

async function idsOf(
  app: Hono,
  query: string,
): Promise<{ status: number; ids: string[]; total: number }> {
  const res = await app.request(`/api/works?${query}`);
  const body = (await res.json()) as { items?: Array<{ id: string }>; total?: number };
  return {
    status: res.status,
    ids: (body.items ?? []).map((item) => item.id).sort(),
    total: body.total ?? 0,
  };
}

test("scanRecord=new は記録の新規作品だけを返し、記録が空なら0件", async () => {
  const { store, app } = setup();
  assert.equal((await idsOf(app, "scanRecord=new")).total, 0);
  store.replace(result({ insertedWorkIds: ["RJ501001", "RJ501002"] }), "t");
  store.addNewWorks(["RJ501003"]);
  assert.deepEqual((await idsOf(app, "scanRecord=new")).ids, ["RJ501001", "RJ501002", "RJ501003"]);
});

test("scanRecord=updated は scanChange で変化の種類を絞れ、updated 以外では scanChange を拒否する", async () => {
  const { store, app } = setup();
  store.replace(
    result({
      updatedWorks: [
        {
          workId: "RJ501001",
          changes: [{ kind: "moved", from: workspacePath("a"), to: workspacePath("b") }],
        },
        { workId: "RJ501002", changes: [{ kind: "files", audioDelta: 2 }] },
        { workId: "RJ501004", changes: [{ kind: "meta" }, { kind: "files", audioDelta: 0 }] },
      ],
    }),
    "t",
  );
  assert.deepEqual((await idsOf(app, "scanRecord=updated")).ids, [
    "RJ501001",
    "RJ501002",
    "RJ501004",
  ]);
  assert.deepEqual((await idsOf(app, "scanRecord=updated&scanChange=moved")).ids, ["RJ501001"]);
  assert.deepEqual((await idsOf(app, "scanRecord=updated&scanChange=files")).ids, [
    "RJ501002",
    "RJ501004",
  ]);
  assert.equal((await idsOf(app, "scanRecord=new&scanChange=moved")).status, 400);
  assert.equal((await idsOf(app, "scanChange=moved")).status, 400);
});

test("DELETE /works/:id した作品は、記録を読むときにすべての項目から落ちる", async () => {
  const { adapter, store, app } = setup();
  store.replace(
    result({
      insertedWorkIds: ["RJ501001"],
      updatedWorks: [{ workId: "RJ501001", changes: [{ kind: "meta" }] }],
    }),
    "t",
  );
  const before = await snapshotOf(adapter, store);
  assert.equal(before.updatedWorks.length, 1);
  assert.deepEqual((await idsOf(app, "scanRecord=new")).ids, ["RJ501001"]);

  const res = await app.request("/api/works/RJ501001", { method: "DELETE" });
  assert.equal(res.status, 204);

  const after = await snapshotOf(adapter, store);
  assert.deepEqual(after.updatedWorks, []);
  assert.deepEqual((await idsOf(app, "scanRecord=new")).ids, []);
});

async function reassignWithRecord(path: string) {
  const adapter = createFixtureAdapter({ scenario: "new-work" });
  const store = new ScanRecordStore();
  const app = new Hono().route("/api", worksRoute(adapter, store));
  store.replace(
    result({
      insertedWorkIds: ["RJ501001", "RJ501002"],
      updatedWorks: [{ workId: "RJ501001", changes: [{ kind: "meta" }] }],
    }),
    "t",
  );
  const res = await app.request("/api/works/identity-conflicts/reassign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path }),
  });
  assert.equal(res.status, 201);
  const body = (await res.json()) as { snapshot: { id: string } };
  return { adapter, app, store, body };
}

test("ID再採番で登録側を直すと、旧IDの作品はコピー側へ移り、記録の項目は残って移った作品を指す", async () => {
  const { adapter, app, store, body } = await reassignWithRecord(
    "dlsite/夜想曲スタジオ/RJ501001_夜更けの図書室で囁き朗読",
  );
  assert.notEqual(body.snapshot.id, "RJ501001");
  assert.deepEqual((await idsOf(app, "scanRecord=new")).ids, ["RJ501001", "RJ501002"]);
  assert.equal((await snapshotOf(adapter, store)).updatedWorks.length, 1);
  const moved = await adapter.getWork("RJ501001");
  assert.ok(moved?.physicalPath.includes("copies/"));
});

test("ID再採番でコピー側を直しても、登録側の作品の記録は残る", async () => {
  const { adapter, app, store } = await reassignWithRecord(
    "copies/RJ501001_夜更けの図書室で囁き朗読",
  );
  assert.deepEqual((await idsOf(app, "scanRecord=new")).ids, ["RJ501001", "RJ501002"]);
  assert.equal((await snapshotOf(adapter, store)).updatedWorks.length, 1);
});

test("POST /works/unregister-missing した作品は、診断の行方不明から落ちる", async () => {
  const { adapter, app } = setup();
  assert.ok((await adapter.listScanDiagnostics()).missingWorks.length > 0);

  const res = await app.request("/api/works/unregister-missing", { method: "POST" });
  assert.equal(res.status, 200);
  assert.deepEqual((await adapter.listScanDiagnostics()).missingWorks, []);
});

test("fixtureのスキャンは、登録解除した新規作品を次のスキャンで記録へ戻さず、記録を今回の変化へ入れ替える", async () => {
  const adapter = createFixtureAdapter({ scenario: "new-work" });
  const store = new ScanRecordStore();
  const app = new Hono().route("/api", worksRoute(adapter, store));

  const first = await runScan(adapter);
  store.replace(first, "t1");
  assert.deepEqual(store.workIds("new"), first.insertedWorkIds);
  assert.ok(first.insertedWorkIds.length > 0);

  const removed = first.insertedWorkIds[0]!;
  assert.equal((await app.request(`/api/works/${removed}`, { method: "DELETE" })).status, 204);

  const second = await runScan(adapter);
  store.replace(second, "t2");
  assert.deepEqual(store.workIds("new"), []);
  assert.deepEqual((await snapshotOf(adapter, store)).updatedWorks, []);
});
