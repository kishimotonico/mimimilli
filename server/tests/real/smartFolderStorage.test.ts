// smart_folders の保存（ADR-0040「保存先」「既定のスマートフォルダー」）を real アダプタで検証する。
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { SMART_FOLDER_TEMPLATES, findSmartFolderTemplate } from "@mimimilli/shared";
import { UnreadableSmartFolderError } from "../../src/errors.ts";
import { createApp } from "../helpers/testApp.ts";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { smartFolders } from "../../src/adapters/real/userSchema.ts";
import { captureLogs, categoryRecords } from "../helpers/logCapture.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

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
  const added = await second.insertSmartFolder({
    id: "fav",
    name: "お気に入り",
    condition: findSmartFolderTemplate("fav")!.condition,
    sort: null,
    groupBy: null,
    groupSort: null,
    createdAt: new Date().toISOString(),
  });
  assert.equal(added?.position, 1);
  await second.close?.();
});

test("「すべて」の行を消して起動し直すと戻り、ほかの既定は戻らない", async (t) => {
  const directory = makeTestDirectory("sf-all-recover");
  t.after(directory.cleanup);

  const first = openAdapter(directory);
  const before = await first.getSmartFolder("all");
  assert.ok(before);
  await first.deleteSmartFolder("all");
  await first.deleteSmartFolder("fav");
  await first.close?.();

  const second = openAdapter(directory);
  const rows = await second.listSmartFolders();
  const seededIds = SMART_FOLDER_TEMPLATES.filter((template) => template.seeded).map(
    (template) => template.id,
  );
  assert.deepEqual(rows.map((row) => row.id).sort(), seededIds.filter((id) => id !== "fav").sort());
  const all = await second.getSmartFolder("all");
  const template = findSmartFolderTemplate("all")!;
  assert.equal(all?.name, template.name);
  assert.equal(all?.sort, template.sort);
  assert.deepEqual(all?.condition, template.condition);
  assert.equal(all?.groupBy, null);
  assert.equal(all?.groupSort, null);
  await second.close?.();
});

function insertRows(
  directory: ReturnType<typeof makeTestDirectory>,
  rows: Array<Record<string, unknown>>,
) {
  const db = directory.own(
    openDb({
      kind: "files",
      catalogPath: join(directory.path, "catalog.sqlite"),
      userPath: join(directory.path, "user.sqlite"),
    }),
  );
  const healthy = {
    conditionJson: '{"type":"and","children":[{"type":"hasError"}]}',
    sort: "added-desc",
    createdAt: "2026-07-19T00:00:00.000Z",
  };
  db.user
    .insert(smartFolders)
    .values(rows.map((row) => ({ ...healthy, ...row })) as (typeof smartFolders.$inferInsert)[])
    .run();
}

const UNREADABLE_ROWS: Array<{ id: string; column: string; row: Record<string, unknown> }> = [
  { id: "broken-json", column: "condition_json", row: { conditionJson: "{" } },
  {
    id: "broken-shape",
    column: "condition_json",
    row: { conditionJson: '{"type":"or","children":[]}' },
  },
  { id: "empty-name", column: "name", row: { name: "" } },
  { id: "broken-sort", column: "sort", row: { sort: "unknown" } },
  { id: "broken-group", column: "group_by_json", row: { groupByJson: '{"kind":"x"}' } },
  { id: "broken-group-sort", column: "group_sort", row: { groupSort: "unknown" } },
  { id: "orphan-group-sort", column: "group_sort", row: { groupSort: "count-desc" } },
  { id: "missing-group-sort", column: "group_sort", row: { groupByJson: '{"kind":"tag"}' } },
];

for (const { id, column, row } of UNREADABLE_ROWS) {
  test(`読めない行(${id})があると、一覧とその行を引く口が 500 で、行の ID・理由・DB のパス・DELETE のコマンドを返す`, async (t) => {
    const directory = makeTestDirectory("sf-broken");
    t.after(directory.cleanup);
    const adapter = openAdapter(directory);
    const app = createApp(adapter);
    insertRows(directory, [{ id, name: "壊れた行", position: 100, ...row }]);
    const userPath = join(directory.path, "user.sqlite");

    await captureLogs(
      async (records) => {
        for (const path of [
          "/api/smart-folders",
          `/api/smart-folders/${id}/works?sort=added-desc`,
        ]) {
          const res = await app.request(path);
          assert.equal(res.status, 500, path);
          const message = ((await res.json()) as { error: { message: string } }).error.message;
          assert.ok(message.includes(`ID: ${id}`), message);
          assert.ok(message.includes(column), message);
          assert.ok(
            message.includes(
              `sqlite3 "${userPath}" "DELETE FROM smart_folders WHERE id = '${id}'"`,
            ),
            message,
          );
          assert.ok(!message.includes("スマートフォルダー"), message);
        }
        const errors = categoryRecords(records, "http").filter((r) => r.level === "error");
        assert.ok(errors.length >= 2);
        assert.equal(errors[0]!.properties.dbPath, userPath);
        assert.ok(
          String(errors[0]!.properties.message).includes(
            `sqlite3 "${userPath}" "DELETE FROM smart_folders WHERE id = '${id}'"`,
          ),
        );
        assert.deepEqual(
          (errors[0]!.properties.rows as Array<{ id: string }>).map((r) => r.id),
          [id],
        );
      },
      { categories: ["http"] },
    );
  });
}

test("「すべて」の行を手で書き換えて形を壊すと、読めない行として 500 で案内する", async (t) => {
  const directory = makeTestDirectory("sf-broken-all");
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
  db.user.update(smartFolders).set({ sort: null }).where(eq(smartFolders.id, "all")).run();
  const userPath = join(directory.path, "user.sqlite");

  for (const path of ["/api/smart-folders", "/api/smart-folders/all/works?sort=added-desc"]) {
    const res = await app.request(path);
    assert.equal(res.status, 500, path);
    const message = ((await res.json()) as { error: { message: string } }).error.message;
    assert.ok(message.includes("ID: all") && message.includes("sort"), message);
    assert.ok(
      message.includes(`sqlite3 "${userPath}" "DELETE FROM smart_folders WHERE id = 'all'"`),
      message,
    );
  }
  await adapter.deleteSmartFolder("all");
  await adapter.close?.();
  const reopened = openAdapter(directory);
  assert.equal((await reopened.getSmartFolder("all"))?.sort, "added-desc");
  await reopened.close?.();
});

test("読めない行が複数あれば、すべての行を1つの応答にまとめる。行を消すと一覧は読める", async (t) => {
  const directory = makeTestDirectory("sf-broken-many");
  t.after(directory.cleanup);
  const adapter = openAdapter(directory);
  const app = createApp(adapter);
  insertRows(directory, [
    { id: "broken-a", name: "A", position: 100, conditionJson: "{" },
    { id: "broken-b", name: "B", position: 101, sort: "unknown" },
    { id: "ok-error", name: "エラー確認", position: 102 },
  ]);

  const res = await app.request("/api/smart-folders");
  assert.equal(res.status, 500);
  const message = ((await res.json()) as { error: { message: string } }).error.message;
  assert.ok(message.includes("ID: broken-a") && message.includes("ID: broken-b"), message);
  assert.ok(!message.includes("ok-error"), message);

  assert.equal((await adapter.getSmartFolder("ok-error"))?.id, "ok-error");

  await adapter.deleteSmartFolder("broken-a");
  await adapter.deleteSmartFolder("broken-b");
  const list = await app.request("/api/smart-folders");
  assert.equal(list.status, 200);
  assert.ok(((await list.json()) as Array<{ id: string }>).some((f) => f.id === "ok-error"));
});

test("ID にシェルや SQL の特殊文字があっても、DELETE のコマンドは16進のリテラルで指す", () => {
  const id = `a"b$c\`d'e`;
  const error = new UnreadableSmartFolderError(
    [{ id, name: "手書き", problems: [{ column: "sort", reason: "x" }] }],
    "/data/user.sqlite",
  );
  const hex = Buffer.from(id, "utf8").toString("hex");
  assert.ok(
    error.message.includes(
      `sqlite3 "/data/user.sqlite" "DELETE FROM smart_folders WHERE id = CAST(x'${hex}' AS TEXT)"`,
    ),
    error.message,
  );
});
