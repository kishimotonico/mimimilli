// smart_folders の保存（ADR-0040「保存先」「既定のスマートフォルダー」）を real アダプタで検証する。
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import {
  conditionKey,
  SMART_FOLDER_TEMPLATES,
  findSmartFolderTemplate,
  type SmartFolder,
} from "@mimimilli/shared";
import { createApp } from "../helpers/testApp.ts";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { smartFolders } from "../../src/adapters/real/userSchema.ts";
import { createWorkRepos } from "../helpers/workTestUtils.ts";
import { makeTestDirectory, makeTestScope } from "../helpers/sampleLibrary.ts";

function openAdapter(directory: ReturnType<typeof makeTestDirectory>) {
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

test("migration が入れる「すべて」は shared のテンプレートと一致する", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { user } = createWorkRepos(db);

  const rows = user.listSmartFolders();
  assert.deepEqual(
    rows.map((row) => row.id),
    ["all"],
  );
  const row = rows[0]!;
  const template = findSmartFolderTemplate("all")!;
  assert.equal(row.name, template.name);
  assert.equal(row.sort, template.sort);
  assert.equal(row.groupBy, template.groupBy);
  assert.equal(row.position, 0);
  assert.ok(row.condition && conditionKey(row.condition) === conditionKey(template.condition));
  assert.ok(Number.isFinite(Date.parse(row.createdAt)));
});

test("既定は初回だけ投入され、全部消しても再起動で戻らない", async (t) => {
  const directory = makeTestDirectory("sf-seed");
  t.after(directory.cleanup);

  const first = openAdapter(directory);
  const seeded = (await first.listSmartFolders()).map((row) => row.id);
  assert.deepEqual(
    seeded,
    SMART_FOLDER_TEMPLATES.filter((template) => template.seeded).map((template) => template.id),
  );
  for (const id of seeded) if (id !== "all") await first.deleteSmartFolder(id);
  await first.close?.();

  const second = openAdapter(directory);
  assert.deepEqual(
    (await second.listSmartFolders()).map((row) => row.id),
    ["all"],
  );
  const added = await second.appendSmartFolder({
    id: "fav",
    name: "お気に入り",
    condition: findSmartFolderTemplate("fav")!.condition,
    sort: null,
    groupBy: null,
    createdAt: new Date().toISOString(),
  });
  assert.equal(added?.position, 1);
  await second.close?.();
});

test("読めない行があっても一覧は成功し、壊れた行を null で返して件数の対象から外す", async (t) => {
  const directory = makeTestDirectory("sf-broken");
  t.after(directory.cleanup);
  const adapter = openAdapter(directory);
  const app = createApp(adapter);
  const db = directory.own(
    openDb({
      kind: "files",
      catalogPath: join(directory.path, "catalog.sqlite"),
      userPath: join(directory.path, "user.sqlite"),
    }),
  );
  const createdAt = "2026-07-19T00:00:00.000Z";
  const healthy = {
    conditionJson: '{"type":"and","children":[{"type":"hasError"}]}',
    sort: "added-desc",
  };
  db.user
    .insert(smartFolders)
    .values([
      {
        id: "broken-json",
        name: "壊れJSON",
        ...healthy,
        conditionJson: "{",
        position: 100,
        createdAt,
      },
      {
        id: "broken-sort",
        name: "壊れsort",
        ...healthy,
        sort: "unknown",
        position: 101,
        createdAt,
      },
      {
        id: "broken-group",
        name: "壊れgroup",
        ...healthy,
        groupByJson: '{"kind":"x"}',
        position: 102,
        createdAt,
      },
      { id: "ok-error", name: "エラー確認", ...healthy, position: 103, createdAt },
    ])
    .run();

  const res = await app.request("/api/smart-folders");
  assert.equal(res.status, 200);
  const folders = (await res.json()) as SmartFolder[];
  for (const id of ["broken-json", "broken-sort", "broken-group"]) {
    const row = folders.find((f) => f.id === id)!;
    assert.deepEqual(
      [row.condition, row.sort, row.groupBy, row.count],
      [null, null, null, null],
      id,
    );
  }
  assert.equal(folders.find((f) => f.id === "ok-error")!.count, 0);

  const works = await app.request("/api/smart-folders/broken-json/works?sort=added-desc");
  assert.equal(works.status, 409);
  const del = await app.request("/api/smart-folders/broken-json", { method: "DELETE" });
  assert.equal(del.status, 204);
  const fix = await app.request("/api/smart-folders/broken-sort", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "直した",
      condition: { type: "and", children: [] },
      sort: "added-desc",
      groupBy: null,
    }),
  });
  assert.equal(fix.status, 200);
});
