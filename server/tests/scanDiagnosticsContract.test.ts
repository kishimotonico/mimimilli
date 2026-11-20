// 要対応の診断・スキャンの記録・候補一覧の「未スキャン」を、fixtureとrealの両adapterで同じ契約として確かめる。
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import {
  scanCandidatesResponseSchema,
  scanDiagnosticsSchema,
  scanRecordSchema,
} from "@mimimilli/shared";
import type { DataAdapter } from "../src/adapter/index.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createRealAdapter } from "../src/adapters/real/index.ts";
import { openDb } from "../src/adapters/real/db.ts";
import { Scanner } from "../src/adapters/real/scanner.ts";
import { works } from "../src/adapters/real/catalogSchema.ts";
import {
  createWorkRepos,
  makeWork as makeTestWork,
  upsertTestWork,
} from "./helpers/workTestUtils.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { configureRoot } from "./helpers/rootFolder.ts";
import { runScan } from "./helpers/scanLibrary.ts";
import { makeTestDirectory, writeWav } from "./helpers/sampleLibrary.ts";
import { createApp } from "./helpers/testApp.ts";

const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function writeWork(root: string, folder: string, id: string, title: string): void {
  const dir = join(root, folder);
  mkdirSync(dir, { recursive: true });
  writeWav(join(dir, "track.wav"), 1);
  writeFileSync(
    join(dir, "mimimilli.json"),
    JSON.stringify({
      formatVersion: 1,
      id,
      title,
      playlists: [
        {
          id: crypto.randomUUID(),
          name: "default",
          tracks: [{ id: crypto.randomUUID(), title: "t", file: "track.wav" }],
        },
      ],
      defaultPlaylistId: null,
    }),
  );
}

type App = ReturnType<typeof createApp>;

async function getJson(app: App, path: string): Promise<{ status: number; body: any }> {
  const res = await app.request(path);
  return { status: res.status, body: await res.json() };
}

async function diagnosticsOf(app: App) {
  const { status, body } = await getJson(app, "/api/scan/diagnostics");
  assert.equal(status, 200);
  return scanDiagnosticsSchema.parse(body);
}

/** 要対応の行方不明が、ライブラリのエラー表示と同じ作品であること */
async function assertMatchesLibrary(app: App): Promise<void> {
  const diagnostics = await diagnosticsOf(app);
  const errorView = (await getJson(app, "/api/works?view=error&page=1&limit=500")).body;
  assert.deepEqual(
    diagnostics.missingWorks.map((work) => work.workId).sort(),
    errorView.items
      .filter((item: { status: string }) => item.status === "missing")
      .map((item: { id: string }) => item.id)
      .sort(),
  );
}

async function waitForScan(app: App): Promise<void> {
  const started = await app.request("/api/scan", { method: "POST" });
  assert.equal(started.status, 202);
  const { job } = await started.json();
  for (let attempt = 0; attempt < 200; attempt++) {
    const { body } = await getJson(app, `/api/scan/${job.id}`);
    if (body.status === "completed") return;
    assert.ok(["queued", "running"].includes(body.status), `scan ended as ${body.status}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("scan did not complete");
}

async function assertCandidatesUnscannedThenScanned(adapter: DataAdapter, app: App): Promise<void> {
  const before = scanCandidatesResponseSchema.parse(
    (await getJson(app, "/api/scan/candidates")).body,
  );
  assert.deepEqual(before, { scanCompleted: false, candidates: [] });
  const emptyRecord = scanRecordSchema.parse((await getJson(app, "/api/scan/last")).body);
  assert.deepEqual(emptyRecord, { finishedAt: null, updatedWorks: [] });

  await runScan(adapter);
  const after = scanCandidatesResponseSchema.parse(
    (await getJson(app, "/api/scan/candidates")).body,
  );
  assert.equal(after.scanCompleted, true);
  const record = scanRecordSchema.parse((await getJson(app, "/api/scan/last")).body);
  assert.equal(typeof record.finishedAt, "string");
  assert.deepEqual(Object.keys(record).sort(), ["finishedAt", "updatedWorks"]);
}

test("fixture: 診断は5種類をスキャンを待たずに返し、ライブラリの一覧と一致する", async () => {
  const adapter = createFixtureAdapter({ scenario: "needs-attention" });
  const app = createApp(adapter);
  try {
    const diagnostics = await diagnosticsOf(app);
    assert.equal(diagnostics.identityConflicts.length, 1);
    assert.equal(diagnostics.invalidMetaFiles.length, 1);
    assert.deepEqual(diagnostics.unreadablePaths, ["権限なし/フォルダー"]);
    assert.deepEqual(diagnostics.dataIntegrityWorks, [
      { workId: "RJ501099", title: "タグの値が壊れた作品" },
    ]);
    await assertMatchesLibrary(app);

    await runScan(adapter);
    const afterScan = await diagnosticsOf(app);
    assert.ok(afterScan.missingWorks.some((work) => work.workId === "RJ501008"));
    assert.equal(afterScan.identityConflicts[0]?.registeredTitle !== null, true);
    const registeredPath = afterScan.identityConflicts[0]?.registeredPath;
    assert.ok(registeredPath);
    assert.ok(afterScan.identityConflicts[0]?.paths.includes(registeredPath));
    await assertMatchesLibrary(app);
  } finally {
    await app.shutdown();
  }
});

test("fixture: 候補一覧は未スキャンと0件を区別し、記録は完了時刻と更新済みだけ", async () => {
  const adapter = createFixtureAdapter({ scenario: "new-work" });
  const app = createApp(adapter);
  try {
    await assertCandidatesUnscannedThenScanned(adapter, app);
  } finally {
    await app.shutdown();
  }
});

test("real: 診断は行方不明をすべて返し、ライブラリの一覧と一致して、ID重複は登録済みの作品名を持つ", async (t) => {
  const directory = makeTestDirectory("scan-diagnostics-real");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  writeWork(root, "a", ID_A, "作品A");
  writeWork(root, "b", ID_B, "作品B");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  const app = createApp(adapter);
  try {
    await runScan(adapter);
    assert.deepEqual((await diagnosticsOf(app)).missingWorks, []);
    writeWork(root, "copy/b", ID_B, "作品Bのコピー");
    await waitForScan(app);
    let diagnostics = await diagnosticsOf(app);
    assert.deepEqual(
      diagnostics.identityConflicts.map((conflict) => conflict.workId),
      [ID_B],
    );
    assert.equal(diagnostics.identityConflicts[0]?.registeredTitle, "作品B");
    assert.equal(diagnostics.identityConflicts[0]?.registeredPath, "b");
    await assertMatchesLibrary(app);

    rmSync(join(root, "a"), { recursive: true });
    await waitForScan(app);
    await waitForScan(app);
    diagnostics = await diagnosticsOf(app);
    assert.deepEqual(
      diagnostics.missingWorks.map((work) => work.workId),
      [ID_A],
    );
    await assertMatchesLibrary(app);
  } finally {
    await app.shutdown();
  }
});

test("real: 候補一覧は未スキャンと0件を区別し、記録は完了時刻と更新済みだけ", async (t) => {
  const directory = makeTestDirectory("scan-diagnostics-unscanned");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  writeWork(root, "a", ID_A, "作品A");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  const app = createApp(adapter);
  try {
    await assertCandidatesUnscannedThenScanned(adapter, app);
  } finally {
    await app.shutdown();
  }
});

test(
  "real: アクセス不可はスキャン完了で全置換され、中止では置き換わらず、再起動後も同じ内容を返す",
  { skip: process.platform === "win32" && "Windows の chmod は読取拒否にならない" },
  async (t) => {
    const directory = makeTestDirectory("scan-diagnostics-unreadable");
    t.after(directory.cleanup);
    const root = join(directory.path, "lib");
    writeWork(root, "a", ID_A, "作品A");
    const locked = join(root, "locked");
    mkdirSync(locked, { recursive: true });
    const database = {
      kind: "files" as const,
      catalogPath: join(directory.path, "catalog.sqlite"),
      userPath: join(directory.path, "user.sqlite"),
    };

    const db = openDb(database);
    const repos = createWorkRepos(db);
    const scanner = new Scanner(db, repos);
    chmodSync(locked, 0o000);
    try {
      await scanner.scan(root, { full: true });
    } finally {
      chmodSync(locked, 0o755);
    }
    assert.deepEqual(repos.catalog.listUnreadablePaths(), ["locked"]);

    const controller = new AbortController();
    await assert.rejects(
      scanner.scan(
        root,
        { full: true, signal: controller.signal },
        {
          beforeFinalize: () => controller.abort(),
        },
      ),
    );
    assert.deepEqual(repos.catalog.listUnreadablePaths(), ["locked"]);
    db.close();

    const adapterOptions = {
      database,
      dataRoot: directory.path,
      dlsiteCache: { path: join(directory.path, "dlsite-cache.sqlite") },
    };
    const restarted = directory.own(createRealAdapter(adapterOptions));
    await configureRoot(restarted, root);
    const app = createApp(restarted);
    try {
      assert.deepEqual((await diagnosticsOf(app)).unreadablePaths, ["locked"]);
      await waitForScan(app);
      assert.deepEqual((await diagnosticsOf(app)).unreadablePaths, []);
    } finally {
      await app.shutdown();
    }
  },
);

test("real: 読めない作品は、要対応のデータ不整合とライブラリの一覧から外れる作品が同じで、読み直しでも直らなければ残る", async (t) => {
  const directory = makeTestDirectory("scan-diagnostics-integrity");
  t.after(directory.cleanup);
  const database = {
    kind: "files" as const,
    catalogPath: join(directory.path, "catalog.sqlite"),
    userPath: join(directory.path, "user.sqlite"),
  };
  const db = directory.own(openDb(database));
  const { catalog, user } = createWorkRepos(db);
  upsertTestWork(catalog, user, makeTestWork({ id: "work-good" }));
  upsertTestWork(catalog, user, makeTestWork({ id: "work-bad-status", title: "状態が壊れた作品" }));
  upsertTestWork(catalog, user, makeTestWork({ id: "work-bad-urls", title: "URLが壊れた作品" }));
  db.catalog.update(works).set({ status: "unknown" }).where(eq(works.id, "work-bad-status")).run();
  db.catalog.update(works).set({ urlsJson: "{" }).where(eq(works.id, "work-bad-urls")).run();
  user.setUserSetting("root_folder", "/library");
  const adapter = directory.own(
    createRealAdapter({
      database,
      dataRoot: directory.path,
      dlsiteCache: { path: join(directory.path, "dlsite-cache.sqlite") },
    }),
  );
  const app = createApp(adapter);
  try {
    const diagnostics = await diagnosticsOf(app);
    assert.deepEqual(
      [...diagnostics.dataIntegrityWorks].sort((a, b) => a.workId.localeCompare(b.workId)),
      [
        { workId: "work-bad-status", title: "状態が壊れた作品" },
        { workId: "work-bad-urls", title: "URLが壊れた作品" },
      ],
    );

    const list = (await getJson(app, "/api/works?page=1&limit=500")).body;
    assert.deepEqual(
      list.items.map((item: { id: string }) => item.id),
      ["work-good"],
    );
    assert.equal(list.total, 3);

    const reloaded = await app.request("/api/works/work-bad-status/reload", { method: "POST" });
    assert.equal(reloaded.status, 409);
    assert.equal((await reloaded.json()).error.code, "conflict");
    assert.ok(
      (await diagnosticsOf(app)).dataIntegrityWorks.some(
        (work) => work.workId === "work-bad-status",
      ),
    );
  } finally {
    await app.shutdown();
  }
});

test("real: rootの外を指す行方不明の作品は previousPath が null で、診断は500にならない", async (t) => {
  const directory = makeTestDirectory("scan-diagnostics-outside-root");
  t.after(directory.cleanup);
  const database = {
    kind: "files" as const,
    catalogPath: join(directory.path, "catalog.sqlite"),
    userPath: join(directory.path, "user.sqlite"),
  };
  const db = directory.own(openDb(database));
  const { catalog, user } = createWorkRepos(db);
  upsertTestWork(
    catalog,
    user,
    makeTestWork({ id: "inside", status: "missing", physicalPath: "/library/inside" }),
  );
  upsertTestWork(
    catalog,
    user,
    makeTestWork({ id: "windows-outside", status: "missing", physicalPath: "C:/other/work" }),
  );
  upsertTestWork(
    catalog,
    user,
    makeTestWork({ id: "posix-outside", status: "missing", physicalPath: "/elsewhere/work" }),
  );
  user.setUserSetting("root_folder", "/library");
  const adapter = directory.own(
    createRealAdapter({
      database,
      dataRoot: directory.path,
      dlsiteCache: { path: join(directory.path, "dlsite-cache.sqlite") },
    }),
  );
  const app = createApp(adapter);
  try {
    const diagnostics = await diagnosticsOf(app);
    const byId = new Map(diagnostics.missingWorks.map((work) => [work.workId, work.previousPath]));
    assert.equal(byId.get("inside"), "inside");
    assert.equal(byId.get("windows-outside"), null);
    assert.equal(byId.get("posix-outside"), null);
  } finally {
    await app.shutdown();
  }
});

test("fixture: root変更の開始で旧rootの診断が消える", async () => {
  const adapter = createFixtureAdapter({ scenario: "needs-attention" });
  const before = await adapter.listScanDiagnostics();
  assert.ok(before.identityConflicts.length > 0);
  assert.ok(before.invalidMetaFiles.length > 0);
  assert.ok(before.unreadablePaths.length > 0);

  await adapter.beginRootReconfiguration(await adapter.resolveRootFolder("/another-library"));

  const after = await adapter.listScanDiagnostics();
  assert.deepEqual(after.identityConflicts, []);
  assert.deepEqual(after.invalidMetaFiles, []);
  assert.deepEqual(after.unreadablePaths, []);
});
