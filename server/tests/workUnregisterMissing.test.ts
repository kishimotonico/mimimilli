// 欠損作品の一括登録解除（GET /api/works/missing-count, POST /api/works/unregister-missing）
// の契約テスト。real/fixture 両アダプタを実際に通し、「missingのみが対象」「件数の意味論」を縛る。
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { emptyDlsiteState, workspacePath, type Work, type WorkSummary } from "@mimimilli/shared";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { openDb } from "../src/adapters/real/db.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { makeTestDirectory, writeWav } from "./helpers/sampleLibrary.ts";

function workspace(root: string, absolutePath: string) {
  return workspacePath(absolutePath.slice(root.length + 1));
}

interface ContractIds {
  missing: string[];
  error: string;
  ok: string;
}

/** real/fixture 双方の app に対して同じ契約を検証する */
async function assertMissingBulkDeleteContract(
  app: ReturnType<typeof createApp>,
  ids: ContractIds,
): Promise<void> {
  const countRes = await app.request("/api/works/missing-count");
  assert.equal(countRes.status, 200);
  assert.deepEqual(await countRes.json(), { count: ids.missing.length });

  const deleteRes = await app.request("/api/works/unregister-missing", { method: "POST" });
  assert.equal(deleteRes.status, 200);
  assert.deepEqual(await deleteRes.json(), { deletedCount: ids.missing.length, failedCount: 0 });

  for (const missingId of ids.missing) {
    assert.equal((await app.request(`/api/works/${missingId}`)).status, 404);
  }

  const errorRes = await app.request(`/api/works/${ids.error}`);
  assert.equal(errorRes.status, 200);
  assert.equal(((await errorRes.json()) as Work).status, "error");

  assert.equal((await app.request(`/api/works/${ids.ok}`)).status, 200);

  const listBody = await (await app.request("/api/works")).json();
  assert.equal(listBody.total, 2);

  const recountRes = await app.request("/api/works/missing-count");
  assert.deepEqual(await recountRes.json(), { count: 0 });
}

test("POST /api/works/unregister-missing: fixtureアダプタでmissingのみを一括登録解除する", async () => {
  const missingIds = ["missing-1", "missing-2"];
  const baseWork: Omit<WorkSummary, "id" | "status"> = {
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
    dlsite: emptyDlsiteState(),
  };
  const works: WorkSummary[] = [
    { ...baseWork, id: "ok-1", status: "ok" },
    { ...baseWork, id: "error-1", status: "error" },
    ...missingIds.map((id) => ({ ...baseWork, id, status: "missing" }) as WorkSummary),
  ];
  const app = createApp(createFixtureAdapter({ works }));
  await assertMissingBulkDeleteContract(app, { missing: missingIds, error: "error-1", ok: "ok-1" });
});

test("POST /api/works/unregister-missing: realアダプタでmissingのみを一括登録解除する", async (t: TestContext) => {
  const directory = makeTestDirectory("work-unregister-missing-bulk");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "catalog.db");
  const userPath = join(directory.path, "user.db");
  const root = join(directory.path, "lib");

  const adapter = directory.own(
    createTestRealAdapter({ database: { kind: "files", catalogPath, userPath } }),
  );
  const app = createApp(adapter);
  mkdirSync(root, { recursive: true });
  await adapter.updateSettings({ rootFolder: root });

  const ids: string[] = [];
  for (const name of ["ok", "error", "missing1", "missing2"]) {
    const folder = join(root, `RJ90003${ids.length}_${name}`);
    mkdirSync(folder, { recursive: true });
    writeWav(join(folder, "track.wav"), 2);
    const res = await app.request("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: workspace(root, folder), title: name }),
    });
    assert.equal(res.status, 201);
    ids.push(((await res.json()) as Work).id);
  }
  const [okId, errorId, missing1Id, missing2Id] = ids as [string, string, string, string];

  // real アダプタは missing 検出をスキャンで行うため、テストでは直接 status を差し替える。
  const db = openDb({ kind: "files", catalogPath, userPath });
  for (const [id, status] of [
    [errorId, "error"],
    [missing1Id, "missing"],
    [missing2Id, "missing"],
  ] as const) {
    db.sqlite.run("UPDATE main.works SET status = ? WHERE id = ?", [status, id]);
  }
  db.close();

  await assertMissingBulkDeleteContract(app, {
    missing: [missing1Id, missing2Id],
    error: errorId,
    ok: okId,
  });
});
