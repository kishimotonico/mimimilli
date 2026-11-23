// listSummaries の行単位隔離が export / スマートフォルダー / スキャン finalize で継続することを検証する。
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { createApp } from "../helpers/testApp.ts";
import { Scanner } from "../../src/adapters/real/scanner.ts";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { tags, works } from "../../src/adapters/real/catalogSchema.ts";
import { createWorkRepos, makeWork, upsertTestWork } from "../helpers/workTestUtils.ts";
import { makeTestDirectory, makeTestScope } from "../helpers/sampleLibrary.ts";
import { nts } from "../helpers/tag.ts";

function seedCorruptedPair(
  catalog: ReturnType<typeof createWorkRepos>["catalog"],
  user: ReturnType<typeof createWorkRepos>["user"],
  db: ReturnType<typeof openDb>,
): { goodId: string; badId: string } {
  const goodId = "work-good";
  const badId = "work-bad";
  upsertTestWork(catalog, user, makeWork({ id: goodId, tags: nts(["cv/正常"]) }));
  upsertTestWork(catalog, user, {
    ...makeWork({ id: badId, tags: nts(["cv/正常"]) }),
    tags: nts(["cv/正常", "cv/壊れ対象"]),
  });
  db.catalog.update(tags).set({ name: " CV/壊れ " }).where(eq(tags.name, "cv/壊れ対象")).run();
  return { goodId, badId };
}

function openFileDb(dir: string) {
  return openDb({
    kind: "files",
    catalogPath: join(dir, "catalog.sqlite"),
    userPath: join(dir, "user.sqlite"),
  });
}

function fileAdapter(directory: ReturnType<typeof makeTestDirectory>) {
  return directory.own(
    createRealAdapter({
      database: {
        kind: "files",
        catalogPath: join(directory.path, "catalog.sqlite"),
        userPath: join(directory.path, "user.sqlite"),
      },
      dataRoot: directory.path,
      dlsiteCache: { path: join(directory.path, "dlsite-cache.sqlite") },
    }),
  );
}

test("export は壊れた作品を除外し dataIntegrityWarning を返す", async (t) => {
  const directory = makeTestDirectory("export-integrity");
  t.after(directory.cleanup);
  const db = directory.own(openFileDb(directory.path));
  const { catalog, user } = createWorkRepos(db);
  const { goodId, badId } = seedCorruptedPair(catalog, user, db);
  const adapter = fileAdapter(directory);

  const exported = await adapter.exportLibrary();
  const payload = JSON.parse(exported.data) as { works: Array<{ id: string }> };
  assert.deepEqual(
    payload.works.map((work) => work.id),
    [goodId],
  );
  assert.equal(exported.dataIntegrityWarning?.skippedCount, 1);
  assert.deepEqual(exported.dataIntegrityWarning?.skippedWorkIds, [badId]);
});

test("条件の木の一覧は壊れた候補を除外して WorksPage を返す", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query, catalog, user } = createWorkRepos(db);
  const { goodId, badId } = seedCorruptedPair(catalog, user, db);
  const page = query.queryWorksByCondition(
    {
      condition: { type: "and", children: [{ type: "tag", tag: nts(["cv/正常"])[0]! }] },
      sort: "id-asc",
      page: 1,
      limit: 200,
    },
    "/library",
    { now: Date.now() },
  );
  assert.deepEqual(
    page.items.map((item) => item.id),
    [goodId],
  );
  assert.deepEqual(
    query.listDataIntegritySkips().map((skip) => skip.workId),
    [badId],
  );
});

test("診断のデータ不整合は作品一覧から外れる作品と同じ", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query, catalog, user } = createWorkRepos(db);
  upsertTestWork(catalog, user, makeWork({ id: "work-good" }));
  upsertTestWork(catalog, user, makeWork({ id: "work-bad" }));
  db.catalog.update(works).set({ status: "unknown" }).where(eq(works.id, "work-bad")).run();
  const page = query.queryWorksByCondition(
    { condition: { type: "and", children: [] }, sort: "id-asc", page: 1, limit: 200 },
    "/library",
    { now: Date.now() },
  );
  assert.deepEqual(
    page.items.map((item) => item.id),
    ["work-good"],
  );
  assert.deepEqual(
    query.listDataIntegritySkips().map((skip) => skip.workId),
    ["work-bad"],
  );
});

test("スキャン finalize は壊れた作品があっても例外にならず、その作品が診断に載る", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const repos = createWorkRepos(db);
  const { badId } = seedCorruptedPair(repos.catalog, repos.user, db);
  const scanRoot = makeTestDirectory("scan-integrity");
  t.after(scanRoot.cleanup);
  const scanner = new Scanner(db, repos);
  const { result } = await scanner.scan(scanRoot.path, { full: true });
  assert.equal(result.registered, 0);
  assert.deepEqual(
    repos.query.listDataIntegritySkips().map((skip) => skip.workId),
    [badId],
  );
});

test("HTTP smart folder は壊れた作品を除外する", async (t) => {
  const directory = makeTestDirectory("sf-integrity");
  t.after(directory.cleanup);
  const db = directory.own(openFileDb(directory.path));
  const { catalog, user } = createWorkRepos(db);
  const { goodId } = seedCorruptedPair(catalog, user, db);
  user.setUserSetting("root_folder", "/library");
  const folder = user.insertSmartFolder({
    id: "sf-00000000-0000-4000-8000-000000000001",
    name: "タグ一致",
    condition: { type: "and", children: [{ type: "tag", tag: "cv/正常" }] },
    sort: "id-asc",
    groupBy: null,
    groupSort: null,
    createdAt: "2026-07-19T00:00:00.000Z",
  })!;
  const adapter = fileAdapter(directory);
  const app = createApp(adapter);
  const res = await app.request(`/api/smart-folders/${folder.id}/works?sort=id-asc`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    items: Array<{ id: string }>;
  };
  assert.deepEqual(
    body.items.map((item) => item.id),
    [goodId],
  );
});

test("GET /api/works は不正な status の作品を除外し、診断のデータ不整合に載る", async (t) => {
  const directory = makeTestDirectory("works-query-integrity");
  t.after(directory.cleanup);
  const db = directory.own(openFileDb(directory.path));
  const { catalog, user } = createWorkRepos(db);
  const goodId = "work-good";
  const badId = "work-bad";
  upsertTestWork(
    catalog,
    user,
    makeWork({ id: goodId, title: "正常な作品", tags: nts(["cv/正常"]) }),
  );
  upsertTestWork(
    catalog,
    user,
    makeWork({ id: badId, title: "壊れた作品", tags: nts(["cv/正常"]) }),
  );
  db.catalog.update(works).set({ status: "unknown" }).where(eq(works.id, badId)).run();
  user.setUserSetting("root_folder", "/library");
  const adapter = fileAdapter(directory);
  const app = createApp(adapter);
  const res = await app.request("/api/smart-folders/all/works?sort=added-desc");
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    items: Array<{ id: string }>;
    total: number;
  };
  assert.deepEqual(
    body.items.map((item) => item.id),
    [goodId],
  );
  assert.equal(body.total, 2);
  const diagnostics = await (await app.request("/api/scan/diagnostics")).json();
  assert.deepEqual(
    diagnostics.dataIntegrityWorks.map((work: { workId: string }) => work.workId),
    [badId],
  );
});

test("データ不整合の作品名が文字列でなくても診断は読めて、作品名は null になる", async (t) => {
  const directory = makeTestDirectory("works-query-integrity-blob-title");
  t.after(directory.cleanup);
  const db = directory.own(openFileDb(directory.path));
  const { catalog, user } = createWorkRepos(db);
  const badId = "work-bad";
  upsertTestWork(catalog, user, makeWork({ id: badId, tags: nts(["cv/正常"]) }));
  db.catalog.update(works).set({ status: "unknown" }).where(eq(works.id, badId)).run();
  db.sqlite.run("UPDATE main.works SET title = X'00FF' WHERE id = ?", [badId]);
  user.setUserSetting("root_folder", "/library");
  const app = createApp(fileAdapter(directory));
  const res = await app.request("/api/scan/diagnostics");
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).dataIntegrityWorks, [{ workId: badId, title: null }]);
});
