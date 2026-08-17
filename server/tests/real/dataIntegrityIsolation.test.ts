// listSummaries の行単位隔離が export / スマートフォルダー / スキャン finalize で継続することを検証する。
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import type { Work } from "@mimimilli/shared";
import { createApp } from "../../src/app.ts";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { tags } from "../../src/adapters/real/catalogSchema.ts";
import { Scanner } from "../../src/adapters/real/scanner.ts";
import { querySmartFolderWorks } from "../../src/adapters/real/smartFolderWorks.ts";
import { createWorkRepos, upsertTestWork, resolvedDuration } from "../helpers/workTestUtils.ts";
import { makeTestDirectory, makeTestScope } from "../helpers/sampleLibrary.ts";
import { nts } from "../helpers/tag.ts";

function sampleWork(id: string, tag: string): Work {
  const playlistId = `${id}-playlist`;
  const trackId = `${id}-track`;
  return {
    id,
    title: `作品 ${id}`,
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: 10,
    addedAt: "2026-07-19T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: nts([tag]),
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [
          {
            id: trackId,
            title: "track",
            file: "track.wav",
            ...resolvedDuration(60),
          },
        ],
      },
    ],
    bookmarked: false,
    lastPlayedAt: null,
    resume: null,
    dlsite: {
      rjCode: null,
      status: "none",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: [],
    },
  };
}

function seedCorruptedPair(
  catalog: ReturnType<typeof createWorkRepos>["catalog"],
  user: ReturnType<typeof createWorkRepos>["user"],
  db: ReturnType<typeof openDb>,
): { goodId: string; badId: string } {
  const goodId = "work-good";
  const badId = "work-bad";
  upsertTestWork(catalog, user, sampleWork(goodId, "cv/正常"));
  upsertTestWork(catalog, user, {
    ...sampleWork(badId, "cv/正常"),
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

test("ルールベース smart folder は壊れた候補を除外して WorksPage を返す", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query, catalog, user } = createWorkRepos(db);
  const { goodId, badId } = seedCorruptedPair(catalog, user, db);
  const page = querySmartFolderWorks(
    query,
    {
      rules: [
        {
          conjunction: "WHERE",
          field: "タグ",
          operator: "∋",
          values: nts(["cv/正常"]),
        },
      ],
      sort: "id-asc",
    },
    { page: 1, limit: 200 },
    "/library",
  );
  assert.deepEqual(
    page.items.map((item) => item.id),
    [goodId],
  );
  assert.equal(page.dataIntegrityWarning?.skippedCount, 1);
  assert.deepEqual(page.dataIntegrityWarning?.skippedWorkIds, [badId]);
});

test("スキャン finalize は壊れた作品があっても ScanResult を返す", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const repos = createWorkRepos(db);
  const { badId } = seedCorruptedPair(repos.catalog, repos.user, db);
  const scanRoot = makeTestDirectory("scan-integrity");
  t.after(scanRoot.cleanup);
  const scanner = new Scanner(db, repos);
  const result = await scanner.scan(scanRoot.path, { full: true });
  assert.equal(result.dataIntegrityWarning?.skippedCount, 1);
  assert.deepEqual(result.dataIntegrityWarning?.skippedWorkIds, [badId]);
  assert.equal(typeof result.rjCodeMissingCount, "number");
});

test("DLsite 一括取得は壊れた作品を除外し dataIntegrityWarning を返す", async (t) => {
  const directory = makeTestDirectory("dlsite-bulk-integrity");
  t.after(directory.cleanup);
  const db = directory.own(openFileDb(directory.path));
  const { catalog, user } = createWorkRepos(db);
  const { badId } = seedCorruptedPair(catalog, user, db);
  const adapter = fileAdapter(directory);

  const result = await adapter.runDlsiteBulk("existing", undefined);
  assert.equal(result.dataIntegrityWarning?.skippedCount, 1);
  assert.deepEqual(result.dataIntegrityWarning?.skippedWorkIds, [badId]);
});

test("DLsite 一括取得: workIds に含まない壊れた作品は dataIntegrityWarning に出ない", async (t) => {
  const directory = makeTestDirectory("dlsite-bulk-scope");
  t.after(directory.cleanup);
  const db = directory.own(openFileDb(directory.path));
  const { catalog, user } = createWorkRepos(db);
  const { goodId } = seedCorruptedPair(catalog, user, db);
  const adapter = fileAdapter(directory);

  const result = await adapter.runDlsiteBulk("existing", [goodId]);
  assert.equal(result.dataIntegrityWarning, undefined);
});

test("DLsite 一括取得: workIds に含まれる壊れた作品は dataIntegrityWarning に出る", async (t) => {
  const directory = makeTestDirectory("dlsite-bulk-scope-bad");
  t.after(directory.cleanup);
  const db = directory.own(openFileDb(directory.path));
  const { catalog, user } = createWorkRepos(db);
  const { badId } = seedCorruptedPair(catalog, user, db);
  const adapter = fileAdapter(directory);

  const result = await adapter.runDlsiteBulk("existing", [badId]);
  assert.equal(result.dataIntegrityWarning?.skippedCount, 1);
  assert.deepEqual(result.dataIntegrityWarning?.skippedWorkIds, [badId]);
});

test("HTTP smart folder は dataIntegrityWarning を返す", async (t) => {
  const directory = makeTestDirectory("sf-integrity");
  t.after(directory.cleanup);
  const db = directory.own(openFileDb(directory.path));
  const { catalog, user } = createWorkRepos(db);
  const { goodId, badId } = seedCorruptedPair(catalog, user, db);
  user.setUserSetting("root_folder", "/library");
  const folder = user.createSmartFolder({
    name: "タグ一致",
    rules: [
      {
        conjunction: "WHERE",
        field: "タグ",
        operator: "∋",
        values: nts(["cv/正常"]),
      },
    ],
    sort: "id-asc",
  });
  const adapter = fileAdapter(directory);
  const app = createApp(adapter);
  const res = await app.request(`/api/smart-folders/${folder.id}/works`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    items: Array<{ id: string }>;
    dataIntegrityWarning?: { skippedCount: number; skippedWorkIds: string[] };
  };
  assert.deepEqual(
    body.items.map((item) => item.id),
    [goodId],
  );
  assert.equal(body.dataIntegrityWarning?.skippedCount, 1);
  assert.deepEqual(body.dataIntegrityWarning?.skippedWorkIds, [badId]);
});
