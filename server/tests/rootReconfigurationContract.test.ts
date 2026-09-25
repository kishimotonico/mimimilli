// root再設定（ADR-0029）の契約。real/fixture の両アダプタで同じワークフローを HTTP 経由で確認する。
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  rootReconfigurationStateSchema,
  settingsSchema,
  type RootReconfigurationState,
} from "@mimimilli/shared";
import type { DataAdapter } from "../src/adapter/index.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { FIXTURE_UNREADABLE_ROOT } from "../src/adapters/fixture/scenarios.ts";
import { createApp, type App } from "../src/app.ts";
import { ROOT_RECONFIGURATION_INTERRUPTED_MESSAGE } from "../src/rootReconfiguration.ts";
import { pollUntil } from "./helpers/poll.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { configureRoot } from "./helpers/rootFolder.ts";
import { makeTestDirectory, writeWav } from "./helpers/sampleLibrary.ts";

interface Harness {
  adapter: DataAdapter;
  app: App;
  /** 初期root。keptWorkId と droppedWorkId の両方を含む */
  oldRoot: string;
  /** keptWorkId だけを含む、oldRoot 配下のroot */
  newRoot: string;
  /** 検証は通るが構築で失敗するroot */
  unreadableRoot: string;
  keptWorkId: string;
  droppedWorkId: string;
  /** サーバー再起動に相当する。realはアダプタもDBファイルから作り直す */
  restart(): Promise<void>;
}

type HarnessFactory = (t: { after(fn: () => void | Promise<void>): void }) => Promise<Harness>;

function metaWithSingleTrack(id: string, title: string): unknown {
  return {
    formatVersion: 1,
    id,
    title,
    playlists: [
      {
        id: crypto.randomUUID(),
        name: "default",
        tracks: [{ id: crypto.randomUUID(), title: "track", file: "track.wav" }],
      },
    ],
    defaultPlaylistId: null,
  };
}

function writeWork(dir: string, id: string, title: string): void {
  mkdirSync(dir, { recursive: true });
  writeWav(join(dir, "track.wav"), 1);
  writeFileSync(join(dir, "mimimilli.json"), JSON.stringify(metaWithSingleTrack(id, title)));
}

const fixtureHarness: HarnessFactory = async (t) => {
  const adapter = createFixtureAdapter({ rootRebuildStepMs: 1 });
  const harness: Harness = {
    adapter,
    app: createApp(adapter),
    oldRoot: "/library",
    newRoot: "/library/dlsite/夜想曲スタジオ",
    unreadableRoot: FIXTURE_UNREADABLE_ROOT,
    keptWorkId: "RJ501001",
    droppedWorkId: "RJ501003",
    async restart() {
      await harness.app.shutdown();
      harness.app = createApp(adapter);
    },
  };
  t.after(() => harness.app.shutdown());
  return harness;
};

const realHarness: HarnessFactory = async (t) => {
  const directory = makeTestDirectory("root-reconfiguration");
  const oldRoot = join(directory.path, "library");
  const newRoot = join(oldRoot, "kept");
  const unreadableRoot = join(directory.path, "unreadable");
  const keptWorkId = crypto.randomUUID();
  const droppedWorkId = crypto.randomUUID();
  writeWork(join(newRoot, "work"), keptWorkId, "残る作品");
  writeWork(join(oldRoot, "dropped", "work"), droppedWorkId, "外れる作品");
  mkdirSync(unreadableRoot);
  chmodSync(unreadableRoot, 0o000);
  directory.ownFn(unreadableRoot, (path) => chmodSync(path, 0o755));
  const database = {
    kind: "files" as const,
    catalogPath: join(directory.path, "data", "db", "catalog.sqlite"),
    userPath: join(directory.path, "data", "db", "user.sqlite"),
  };
  const openAdapter = () =>
    createTestRealAdapter({
      database,
      dataRoot: join(directory.path, "data"),
      thumbnailCacheDir: join(directory.path, "data", "thumbnails"),
    });
  const seed = openAdapter();
  await configureRoot(seed, oldRoot);
  await seed.scan();
  seed.close();

  let adapter = openAdapter();
  const harness: Harness = {
    adapter,
    app: createApp(adapter),
    oldRoot: realpathSync(oldRoot),
    newRoot: realpathSync(newRoot),
    unreadableRoot: realpathSync(unreadableRoot),
    keptWorkId,
    droppedWorkId,
    async restart() {
      await harness.app.shutdown();
      adapter.close();
      adapter = openAdapter();
      harness.adapter = adapter;
      harness.app = createApp(adapter);
    },
  };
  t.after(async () => {
    await harness.app.shutdown();
    adapter.close();
    directory.cleanup();
  });
  return harness;
};

const harnesses: Array<[string, HarnessFactory]> = [
  ["fixture", fixtureHarness],
  ["real", realHarness],
];

async function getState(app: App): Promise<RootReconfigurationState> {
  const res = await app.request("/api/root-reconfiguration");
  assert.equal(res.status, 200);
  return rootReconfigurationStateSchema.parse(await res.json());
}

async function start(app: App, rootFolder: string): Promise<Response> {
  return app.request("/api/root-reconfiguration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rootFolder }),
  });
}

async function reconfigure(app: App, rootFolder: string): Promise<RootReconfigurationState> {
  const res = await start(app, rootFolder);
  assert.equal(res.status, 202);
  const accepted = rootReconfigurationStateSchema.parse(await res.json());
  assert.equal(accepted.status, "running");
  await pollUntil(async () => (await getState(app)).status !== "running");
  return getState(app);
}

async function listWorkIds(app: App): Promise<string[]> {
  const res = await app.request("/api/works");
  assert.equal(res.status, 200);
  const body = (await res.json()) as { items: Array<{ id: string }> };
  return body.items.map((item) => item.id);
}

async function assertRootReconfiguring(res: Response): Promise<void> {
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "root_reconfiguring");
}

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** 再設定完了直後のidle状態を縛る。completedAtの値そのものは固定できないため、
 *  ISO形式の文字列であることを検証する。 */
function assertIdleAfterCompletion(state: RootReconfigurationState): void {
  assert.equal(state.status, "idle");
  if (state.status !== "idle") return;
  assert.equal(typeof state.completedAt, "string");
  assert.match(state.completedAt as string, ISO_TIMESTAMP_RE);
}

for (const [kind, createHarness] of harnesses) {
  test(`${kind}: 旧rootにだけあった作品はcatalogから外れ、rootを戻すとuser状態ごと戻る`, async (t) => {
    const h = await createHarness(t);
    const bookmark = await h.app.request(`/api/works/${h.droppedWorkId}/bookmark`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookmarked: true }),
    });
    assert.equal(bookmark.status, 200);

    assertIdleAfterCompletion(await reconfigure(h.app, h.newRoot));
    const ids = await listWorkIds(h.app);
    assert.ok(ids.includes(h.keptWorkId));
    assert.ok(!ids.includes(h.droppedWorkId));
    assert.equal((await h.app.request(`/api/works/${h.droppedWorkId}`)).status, 404);
    const settings = settingsSchema.parse(await (await h.app.request("/api/settings")).json());
    assert.equal(settings.rootFolder, h.newRoot);
    assertIdleAfterCompletion(settings.rootReconfiguration);
    assert.equal((await h.app.request("/api/scan/last")).status, 200);

    assertIdleAfterCompletion(await reconfigure(h.app, h.oldRoot));
    const restored = await h.app.request(`/api/works/${h.droppedWorkId}`);
    assert.equal(restored.status, 200);
    assert.equal(((await restored.json()) as { bookmarked: boolean }).bookmarked, true);
  });

  test(`${kind}: 完了のたびcompletedAtが更新される（同じrootへの再構築でも変わる）`, async (t) => {
    const h = await createHarness(t);
    const afterFirst = await reconfigure(h.app, h.newRoot);
    assertIdleAfterCompletion(afterFirst);

    const afterSecond = await reconfigure(h.app, h.newRoot);
    assertIdleAfterCompletion(afterSecond);
    assert.ok(afterFirst.status === "idle" && afterSecond.status === "idle");
    assert.notEqual(
      (afterSecond as { completedAt: string }).completedAt,
      (afterFirst as { completedAt: string }).completedAt,
    );
  });

  test(`${kind}: 構築に失敗すると失敗状態を保ち、通常APIを拒否したまま再試行できる`, async (t) => {
    const h = await createHarness(t);
    const failed = await reconfigure(h.app, h.unreadableRoot);
    assert.equal(failed.status, "failed");
    assert.ok(failed.status === "failed" && failed.rootFolder === h.unreadableRoot);
    assert.ok(failed.status === "failed" && failed.message.length > 0);

    const settings = settingsSchema.parse(await (await h.app.request("/api/settings")).json());
    assert.deepEqual(settings.rootReconfiguration, failed);
    await assertRootReconfiguring(await h.app.request("/api/works"));

    // fixtureには物理FSがないため、存在しないパスの検証はrealだけで確認する。
    const invalidPaths = [
      "relative/library",
      ...(kind === "real" ? [join(h.oldRoot, "存在しないフォルダー")] : []),
    ];
    for (const path of invalidPaths) {
      assert.equal((await start(h.app, path)).status, 400, path);
      assert.deepEqual(await getState(h.app), failed);
    }

    assertIdleAfterCompletion(await reconfigure(h.app, h.newRoot));
    assert.ok((await listWorkIds(h.app)).includes(h.keptWorkId));
  });

  test(`${kind}: 再設定中・失敗中は許可リスト以外のAPIを409 root_reconfiguringで拒否する`, async (t) => {
    const h = await createHarness(t);
    await reconfigure(h.app, h.unreadableRoot);

    for (const path of ["/api/settings", "/api/root-reconfiguration"]) {
      assert.equal((await h.app.request(path)).status, 200, path);
    }
    const denied: Array<[string, string]> = [
      ["GET", "/api/works"],
      ["GET", `/api/works/${h.keptWorkId}`],
      ["GET", "/api/fs"],
      ["GET", `/api/media/cover/${h.keptWorkId}`],
      ["GET", `/api/media/audio/${h.keptWorkId}/track.wav`],
      ["POST", "/api/scan"],
      ["GET", "/api/scan/candidates"],
      ["GET", "/api/dlsite/notifications"],
      ["GET", "/api/tags"],
      ["GET", "/api/smart-folders"],
    ];
    for (const [method, path] of denied) {
      await assertRootReconfiguring(await h.app.request(path, { method }));
    }
  });

  test(`${kind}: ロック確立前に受理済みのscan開始要求は再構築開始前に取り消され、削除済み作品を再投入しない`, async (t) => {
    const h = await createHarness(t);
    let releaseBody: (() => void) | undefined;
    const bodyReady = new Promise<void>((resolve) => {
      releaseBody = resolve;
    });
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        await bodyReady;
        controller.enqueue(new TextEncoder().encode("{}"));
        controller.close();
      },
    });

    // ロック判定はscanのbody受信より前に行われるため、bodyを止めたまま送出しても
    // 再設定を開始していない時点ではロックに引っかからず受理される。
    const scanPromise = h.app.request("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit);

    const reconfigurePromise = reconfigure(h.app, h.newRoot);
    // scanのbody到着を、再設定開始要求より後まで遅らせる。
    await new Promise((resolve) => setTimeout(resolve, 20));
    releaseBody?.();

    const scanRes = await scanPromise;
    assert.equal(scanRes.status, 202);
    const { job } = (await scanRes.json()) as { job: { id: string } };

    assertIdleAfterCompletion(await reconfigurePromise);

    const scanJob = await h.app.request(`/api/scan/${job.id}`);
    assert.equal(scanJob.status, 200);
    assert.equal(((await scanJob.json()) as { status: string }).status, "cancelled");

    const ids = await listWorkIds(h.app);
    assert.ok(ids.includes(h.keptWorkId));
    assert.ok(!ids.includes(h.droppedWorkId));
  });

  test(`${kind}: 再起動後も失敗・中断した再設定を状態から判断できる`, async (t) => {
    const h = await createHarness(t);
    const failed = await reconfigure(h.app, h.unreadableRoot);
    await h.restart();
    assert.deepEqual(await getState(h.app), failed);
    await assertRootReconfiguring(await h.app.request("/api/works"));

    await h.adapter.beginRootReconfiguration(h.newRoot);
    await h.restart();
    assert.deepEqual(await getState(h.app), {
      status: "failed",
      rootFolder: h.newRoot,
      message: ROOT_RECONFIGURATION_INTERRUPTED_MESSAGE,
    });
    await assertRootReconfiguring(await h.app.request("/api/works"));

    assertIdleAfterCompletion(await reconfigure(h.app, h.newRoot));
    assert.equal((await h.app.request("/api/works")).status, 200);
  });
}

test("fixture: 開始時に実行中のscanジョブを取り消し、再設定中は開始要求を409 conflictで拒否する", async (t) => {
  const adapter = createFixtureAdapter({ rootRebuildStepMs: 20 });
  const app = createApp(adapter);
  t.after(() => app.shutdown());
  const scan = await app.request("/api/scan", { method: "POST" });
  assert.equal(scan.status, 202);
  const { job } = (await scan.json()) as { job: { id: string } };

  assert.equal((await start(app, "/library/dlsite")).status, 202);
  const running = await getState(app);
  assert.equal(running.status, "running");
  await assertRootReconfiguring(await app.request(`/api/scan/${job.id}`));
  const duplicate = await start(app, "/library");
  assert.equal(duplicate.status, 409);
  assert.equal(((await duplicate.json()) as { error: { code: string } }).error.code, "conflict");

  await pollUntil(async () => (await getState(app)).status !== "running");
  const cancelled = await app.request(`/api/scan/${job.id}`);
  assert.equal(((await cancelled.json()) as { status: string }).status, "cancelled");
});

test("fixture: root-reconfiguration-failed シナリオは失敗状態で起動し、旧rootへの再試行で作品が戻る", async (t) => {
  const app = createApp(
    createFixtureAdapter({ scenario: "root-reconfiguration-failed", rootRebuildStepMs: 1 }),
  );
  t.after(() => app.shutdown());
  const state = await getState(app);
  assert.equal(state.status, "failed");
  assert.ok(state.status === "failed" && state.rootFolder === FIXTURE_UNREADABLE_ROOT);
  await assertRootReconfiguring(await app.request("/api/works"));

  assertIdleAfterCompletion(await reconfigure(app, "/library"));
  assert.ok((await listWorkIds(app)).includes("RJ501001"));
});
