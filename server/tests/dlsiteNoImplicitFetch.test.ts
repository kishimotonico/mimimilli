// スキャン完了・候補登録・作品登録・root再設定のどれもDLsiteへ通信せず、取得ジョブも作らないことを縛る（ADR-0033）。
// 通信回数はrealアダプタのスケジューラのtransportで数える。
import assert from "node:assert/strict";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { workspacePath } from "@mimimilli/shared";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../src/adapters/real/dlsiteConfig.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { configureRoot } from "./helpers/rootFolder.ts";
import { htmlResponse, mockDlsiteTransport, sampleWorkHtml } from "./helpers/dlsiteTransport.ts";
import { pollUntil } from "./helpers/poll.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { makeTestDirectory, writeWav } from "./helpers/sampleLibrary.ts";
import { createApp } from "./helpers/testApp.ts";

const OWNER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAYLIST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TRACK_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function writeMetaWork(workDir: string) {
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
  writeFileSync(
    join(workDir, "mimimilli.json"),
    `${JSON.stringify({
      formatVersion: 1,
      id: OWNER_ID,
      title: "RJコードあり",
      playlists: [
        {
          id: PLAYLIST_ID,
          name: "default",
          tracks: [{ id: TRACK_ID, title: "本編", file: "track.wav" }],
        },
      ],
      defaultPlaylistId: PLAYLIST_ID,
      dlsite: { rjCode: "RJ900002", status: "none", appliedTags: [] },
    })}\n`,
  );
}

function writePlainWork(workDir: string) {
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
}

const post = (app: ReturnType<typeof createApp>, path: string, body?: unknown) =>
  Promise.resolve(
    app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );

async function scanToCompletion(app: ReturnType<typeof createApp>) {
  assert.equal((await post(app, "/api/scan", {})).status, 202);
  await pollUntil(async () => (await app.request("/api/scan/active")).status === 204);
}

async function assertNoDlsiteJob(app: ReturnType<typeof createApp>) {
  assert.deepEqual(await (await app.request("/api/dlsite/jobs/current")).json(), { job: null });
}

test("スキャン完了・候補登録・作品登録3経路・root再設定のどれもDLsiteへ通信せず、取得ジョブも作らない（real）", async (t) => {
  const directory = makeTestDirectory("dlsite-no-implicit-fetch");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  writeMetaWork(join(root, "owned"));
  writePlainWork(join(root, "RJ900003_候補"));
  writePlainWork(join(root, "plain"));
  let httpCalls = 0;
  const adapter = directory.own(
    createTestRealAdapter({
      database: { kind: "memory" },
      dlsiteRequestConfig: {
        ...DEFAULT_DLSITE_REQUEST_CONFIG,
        requestIntervalMs: 0,
        retryCount: 0,
        timeoutMs: 1_000,
      },
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        handler: () => {
          httpCalls += 1;
          return htmlResponse(sampleWorkHtml("RJ900002"));
        },
      }),
    }),
  );
  const app = createApp(adapter);
  await configureRoot(adapter, root);

  await scanToCompletion(app);
  assert.equal(
    (await (await app.request("/api/scan/last")).json()).result.insertedWorkIds.length,
    1,
  );
  assert.equal(httpCalls, 0);
  await assertNoDlsiteJob(app);

  const candidates = (await (await app.request("/api/scan/candidates")).json())
    .candidates as Array<{
    path: string;
  }>;
  const target = candidates.filter((candidate) => candidate.path.endsWith("RJ900003_候補"));
  assert.equal(target.length, 1);
  const registered = await post(app, "/api/scan/candidates/register", {
    items: target.map((candidate) => ({ path: candidate.path })),
  });
  assert.equal(registered.status, 201);
  assert.equal(httpCalls, 0);
  await assertNoDlsiteJob(app);

  const created = await post(app, "/api/works", {
    path: workspacePath("plain"),
    title: "手動登録",
  });
  assert.equal(created.status, 201);
  const projected = await post(app, "/api/works/projection", { path: "owned" });
  assert.equal(projected.status, 200);
  assert.equal(httpCalls, 0);
  await assertNoDlsiteJob(app);

  cpSync(join(root, "owned"), join(root, "owned-copy"), { recursive: true });
  await scanToCompletion(app);
  const diagnostics = await (await app.request("/api/scan/diagnostics")).json();
  const conflict = diagnostics.identityConflicts.find(
    (item: { kind: string }) => item.kind === "identity_conflict",
  );
  assert.ok(conflict);
  const reassigned = await post(app, "/api/works/identity-conflicts/reassign", {
    path: conflict.paths.find((path: string) => path.endsWith("owned-copy")),
  });
  assert.equal(reassigned.status, 201);
  assert.equal(httpCalls, 0);
  await assertNoDlsiteJob(app);

  const reconfigured = await post(app, "/api/root-reconfiguration", { rootFolder: root });
  assert.equal(reconfigured.status, 202);
  await pollUntil(
    async () =>
      (await (await app.request("/api/root-reconfiguration")).json()).status !== "running",
  );
  assert.equal(httpCalls, 0);
  await assertNoDlsiteJob(app);
  assert.ok(readFileSync(join(root, "owned", "mimimilli.json"), "utf-8").includes("RJ900002"));
});

test("スキャン完了・root再設定でDLsite取得ジョブが作られない（fixture）", async (t) => {
  const adapter = createFixtureAdapter({ scenario: "new-work", rootRebuildStepMs: 1 });
  const app = createApp(adapter);
  t.after(() => app.shutdown());

  await scanToCompletion(app);
  assert.ok((await (await app.request("/api/scan/last")).json()).result.insertedWorkIds.length > 0);
  await assertNoDlsiteJob(app);

  const reconfigured = await post(app, "/api/root-reconfiguration", {
    rootFolder: "/library/dlsite/夜想曲スタジオ",
  });
  assert.equal(reconfigured.status, 202);
  await pollUntil(
    async () =>
      (await (await app.request("/api/root-reconfiguration")).json()).status !== "running",
  );
  await assertNoDlsiteJob(app);
});
