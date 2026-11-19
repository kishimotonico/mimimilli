// スキャン完了・候補登録・作品登録・root再設定のどれもDLsiteへ通信せず、取得ジョブも作らないことを縛る（ADR-0033）。
// 通信回数はrealアダプタのスケジューラのtransportで数える。
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { workspacePath } from "@mimimilli/shared";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../src/adapters/real/dlsiteConfig.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { configureRoot } from "./helpers/rootFolder.ts";
import {
  htmlResponse,
  jpegResponse,
  mockDlsiteTransport,
  sampleWorkHtml,
} from "./helpers/dlsiteTransport.ts";
import { NO_DLSITE } from "./helpers/scanLibrary.ts";
import { pollUntil } from "./helpers/poll.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { makeTestDirectory, SAMPLE_COVER_JPEG_BASE64, writeWav } from "./helpers/sampleLibrary.ts";
import { createApp } from "./helpers/testApp.ts";

const SAMPLE_COVER = new Uint8Array(Buffer.from(SAMPLE_COVER_JPEG_BASE64, "base64"));
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
  assert.equal(typeof (await (await app.request("/api/scan/last")).json()).finishedAt, "string");
  assert.equal(httpCalls, 0);
  await assertNoDlsiteJob(app);

  const candidates = (await (await app.request("/api/scan/candidates")).json())
    .candidates as Array<{
    path: string;
  }>;
  const target = candidates.filter((candidate) => candidate.path.endsWith("RJ900003_候補"));
  assert.equal(target.length, 1);
  const registered = await post(app, "/api/scan/candidates/register", {
    paths: target.map((candidate) => candidate.path),
    apply: { title: true, cover: true, tags: true, url: true },
  });
  assert.equal(registered.status, 201);
  assert.equal(httpCalls, 0);
  await assertNoDlsiteJob(app);

  const created = await post(app, "/api/works", {
    path: workspacePath("plain"),
    title: "手動登録",
    ...NO_DLSITE,
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
  assert.ok((await (await app.request("/api/works?scanRecord=new")).json()).total > 0);
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

async function setupApplyAdapter(
  t: { after: (fn: () => void) => void },
  options: { coverFails?: boolean; clock?: () => number } = {},
) {
  const directory = makeTestDirectory("dlsite-apply-no-http");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  writeMetaWork(join(root, "owned"));
  const calls = { html: 0, cover: 0 };
  const adapter = directory.own(
    createTestRealAdapter({
      database: { kind: "memory" },
      dlsiteCache: { path: join(directory.path, "cache.sqlite"), clock: options.clock },
      dlsiteRequestConfig: {
        ...DEFAULT_DLSITE_REQUEST_CONFIG,
        requestIntervalMs: 0,
        retryCount: 0,
        timeoutMs: 1_000,
      },
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) => {
          calls.html += 1;
          return htmlResponse(sampleWorkHtml(code, { title: "キャッシュのタイトル" }));
        },
        cover: () => {
          calls.cover += 1;
          return options.coverFails
            ? new Response("error", { status: 500 })
            : jpegResponse(SAMPLE_COVER);
        },
      }),
    }),
  );
  const app = createApp(adapter);
  await configureRoot(adapter, root);
  await scanToCompletion(app);
  return { app, adapter, calls, root };
}

async function fetchThenApplyBody(app: ReturnType<typeof createApp>) {
  const fetched = await (await post(app, `/api/dlsite/${OWNER_ID}/fetch`)).json();
  return {
    sourceRevision: fetched.sourceRevision,
    infoRevision: fetched.infoRevision,
    apply: { title: true, cover: true, url: true, tags: [] },
  };
}

test("作品詳細の適用はキャッシュから読み、DLsiteへ通信しない（real）", async (t) => {
  const { app, calls } = await setupApplyAdapter(t);
  const body = await fetchThenApplyBody(app);
  const callsAfterFetch = { ...calls };
  assert.ok(callsAfterFetch.html > 0 && callsAfterFetch.cover > 0);

  const applied = await post(app, `/api/dlsite/${OWNER_ID}/apply`, body);
  assert.equal(applied.status, 200);
  const { snapshot } = await applied.json();
  assert.equal(snapshot.title, "キャッシュのタイトル");
  assert.equal(snapshot.coverImage, "dlsite_cover.jpg");
  assert.deepEqual(calls, callsAfterFetch);
});

test("カバーの先取りに失敗していても適用は成功し、カバー以外を反映して通信しない（real）", async (t) => {
  const { app, calls, root } = await setupApplyAdapter(t, { coverFails: true });
  const body = await fetchThenApplyBody(app);
  const callsAfterFetch = { ...calls };

  const applied = await post(app, `/api/dlsite/${OWNER_ID}/apply`, body);
  assert.equal(applied.status, 200);
  const { snapshot } = await applied.json();
  assert.equal(snapshot.title, "キャッシュのタイトル");
  assert.equal(snapshot.coverImage, null);
  assert.equal(snapshot.urls.length, 1);
  assert.equal(existsSync(join(root, "owned", "dlsite_cover.jpg")), false);
  assert.deepEqual(calls, callsAfterFetch);
});

test("キャッシュのTTLが切れた適用は409 dlsite_refetch_requiredで、通信しない（real）", async (t) => {
  let now = Date.now();
  const { app, calls } = await setupApplyAdapter(t, { clock: () => now });
  const body = await fetchThenApplyBody(app);
  const callsAfterFetch = { ...calls };
  now += 365 * 24 * 60 * 60 * 1000;

  const applied = await post(app, `/api/dlsite/${OWNER_ID}/apply`, body);
  assert.equal(applied.status, 409);
  assert.equal((await applied.json()).error.code, "dlsite_refetch_required");
  assert.deepEqual(calls, callsAfterFetch);
});
