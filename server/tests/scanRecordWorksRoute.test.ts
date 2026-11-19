// GET /works の scanRecord 絞り込みと、登録解除での記録の更新（worksRoute と ScanRecordStore の結線）。
import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { workspacePath, worksQuerySchema, type ScanResult } from "@mimimilli/shared";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { worksRoute } from "../src/routes/works.ts";
import { ScanRecordStore } from "../src/scanRecord.ts";

function result(overrides: Partial<ScanResult>): ScanResult {
  return {
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
    ...overrides,
  };
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

test("DELETE /works/:id は記録の全項目から該当作品を外す", async () => {
  const { store, app } = setup();
  store.replace(
    result({
      insertedWorkIds: ["RJ501001"],
      updatedWorks: [{ workId: "RJ501001", changes: [{ kind: "meta" }] }],
      missingWorks: [{ workId: "RJ501001", title: "t", previousPath: workspacePath("p") }],
      dataIntegrityWarning: { skippedCount: 1, skippedWorkIds: ["RJ501001"] },
    }),
    "t",
  );
  const res = await app.request("/api/works/RJ501001", { method: "DELETE" });
  assert.equal(res.status, 204);
  const snapshot = store.snapshot();
  assert.deepEqual(store.workIds("new"), []);
  assert.deepEqual(snapshot.updatedWorks, []);
  assert.deepEqual(snapshot.missingWorks, []);
  assert.equal(snapshot.dataIntegrityWarning, undefined);
});

test("POST /works/unregister-missing は解除した作品だけ記録から外す", async () => {
  const { adapter, store, app } = setup();
  const missingId = (
    await adapter.queryWorks({
      ...worksQuerySchema.parse({}),
      page: 1,
      limit: 500,
    })
  ).items.find((item) => item.status === "missing")?.id;
  assert.ok(missingId);
  store.replace(
    result({
      missingWorks: [
        { workId: missingId, title: "t", previousPath: workspacePath("p") },
        { workId: "other", title: "o", previousPath: workspacePath("q") },
      ],
    }),
    "t",
  );
  const res = await app.request("/api/works/unregister-missing", { method: "POST" });
  assert.equal(res.status, 200);
  assert.deepEqual(
    store.snapshot().missingWorks.map((work) => work.workId),
    ["other"],
  );
});
