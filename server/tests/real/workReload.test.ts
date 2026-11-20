import {
  REGISTER_ALL,
  listCandidates,
  registerCandidates,
  runScan,
} from "../helpers/scanLibrary.ts";
// 作品単位の読み直し: catalogの値が壊れて除外された作品を、作品情報ファイルから作り直して一覧へ戻す。
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { eq } from "drizzle-orm";
import { createApp } from "../helpers/testApp.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { configureRoot } from "../helpers/rootFolder.ts";
import { pollUntil } from "../helpers/poll.ts";
import { makeSampleLibrary } from "../helpers/sampleLibrary.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { works } from "../../src/adapters/real/catalogSchema.ts";

async function setup(t: TestContext) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const database = {
    kind: "files",
    catalogPath: join(lib.path, "catalog.sqlite"),
    userPath: join(lib.path, "user.sqlite"),
  } as const;
  const adapter = lib.own(createTestRealAdapter({ database, dataRoot: lib.path }));
  await configureRoot(adapter, lib.root);
  await runScan(adapter);
  const registered = await registerCandidates(
    adapter,
    (await listCandidates(adapter)).map((candidate) => candidate.path),
    REGISTER_ALL,
  );
  const otherId = registered.registered[0]!.workId;
  const targetId = lib.existingWorkId;
  const app = createApp(adapter);
  const db = lib.own(openDb(database));

  const corrupt = (id: string) =>
    db.catalog.update(works).set({ status: "unknown" }).where(eq(works.id, id)).run();
  const corruptUser = (id: string) =>
    db.sqlite.run("UPDATE user.work_states SET last_played_at = x'ff' WHERE work_id = ?", [id]);
  const scanAndRead = async () => {
    const started = await app.request("/api/scan", { method: "POST" });
    assert.equal(started.status, 202);
    const { job } = (await started.json()) as { job: { id: string } };
    await pollUntil(async () => {
      const current = (await (await app.request(`/api/scan/${job.id}`)).json()) as {
        status: string;
      };
      return current.status === "completed";
    });
    return integrityIds();
  };
  const integrityIds = async () =>
    (
      (await (await app.request("/api/scan/diagnostics")).json()) as {
        dataIntegrityWorks: Array<{ workId: string }>;
      }
    ).dataIntegrityWorks.map((work) => work.workId);
  const listedIds = async () => {
    const page = (await (await app.request("/api/works")).json()) as {
      items: Array<{ id: string }>;
    };
    return page.items.map((item) => item.id);
  };
  const reload = (id: string) => app.request(`/api/works/${id}/reload`, { method: "POST" });
  return {
    lib,
    app,
    targetId,
    otherId,
    corrupt,
    corruptUser,
    scanAndRead,
    integrityIds,
    listedIds,
    reload,
  };
}

test("読み直すと、除外されていた作品が一覧へ戻り、診断のデータ不整合から消える", async (t) => {
  const { targetId, otherId, corrupt, scanAndRead, integrityIds, listedIds, reload } =
    await setup(t);
  corrupt(targetId);
  assert.deepEqual(await scanAndRead(), [targetId]);
  assert.deepEqual(await listedIds(), [otherId]);

  const res = await reload(targetId);
  assert.equal(res.status, 204);

  assert.deepEqual((await listedIds()).sort(), [targetId, otherId].sort());
  assert.deepEqual(await integrityIds(), []);
  assert.deepEqual(await scanAndRead(), []);
});

test("読み直しで消えるのは対象だけで、ほかの除外された作品は残る", async (t) => {
  const { targetId, otherId, corrupt, scanAndRead, integrityIds, listedIds, reload } =
    await setup(t);
  corrupt(targetId);
  corrupt(otherId);
  await scanAndRead();

  assert.equal((await reload(targetId)).status, 204);
  assert.deepEqual(await integrityIds(), [otherId]);
  assert.deepEqual(await listedIds(), [targetId]);
});

test("作品情報ファイルが無いと読み直しは失敗し、ほかの作品に影響しない", async (t) => {
  const { lib, targetId, otherId, corrupt, scanAndRead, integrityIds, listedIds, reload } =
    await setup(t);
  corrupt(targetId);
  await scanAndRead();
  rmSync(join(lib.root, "dlsite", "RJ900002_既存メタ", "mimimilli.json"));

  const res = await reload(targetId);
  assert.equal(res.status, 409);
  assert.deepEqual(await listedIds(), [otherId]);
  assert.deepEqual(await integrityIds(), [targetId]);
});

test("存在しない作品の読み直しは404", async (t) => {
  const { reload } = await setup(t);
  assert.equal((await reload("no-such-work")).status, 404);
});

test("userの保存値が壊れていて読み直しでは直らないときは409で、診断のデータ不整合も残り、ほかの作品に影響しない", async (t) => {
  const { targetId, otherId, corruptUser, scanAndRead, integrityIds, listedIds, reload } =
    await setup(t);
  corruptUser(targetId);
  await scanAndRead();
  assert.deepEqual(await listedIds(), [otherId]);

  const unresolved = await reload(targetId);
  assert.equal(unresolved.status, 409);
  assert.equal((await unresolved.json()).error.code, "reload_unresolved");

  assert.deepEqual(await listedIds(), [otherId]);
  assert.deepEqual(await integrityIds(), [targetId]);
});
