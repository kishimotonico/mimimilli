import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import sharp from "sharp";
import { emptyMetaDlsiteState, META_FILE_NAME, type DlsiteApplyBody } from "@mimimilli/shared";
import { CoverSaveError, SourceChangedError } from "../../src/errors.ts";
import { createApp } from "../helpers/testApp.ts";
import { writeMetaFile } from "../../src/adapters/real/meta.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../../src/adapters/real/dlsiteConfig.ts";
import {
  htmlResponse,
  jpegResponse,
  mockDlsiteTransport,
  sampleWorkHtml,
} from "../helpers/dlsiteTransport.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { nts } from "../helpers/tag.ts";
import { configureRoot } from "../helpers/rootFolder.ts";
import {
  makeSampleLibrary,
  makeTestDirectory,
  SAMPLE_COVER_JPEG_BASE64,
  writeWav,
} from "../helpers/sampleLibrary.ts";

const SENTINEL = Buffer.from("sentinel-not-an-image");
const NOT_AN_IMAGE = new Uint8Array(Buffer.from("this-is-not-an-image"));

const FAST_REQUESTS = {
  ...DEFAULT_DLSITE_REQUEST_CONFIG,
  requestIntervalMs: 0,
  retryCount: 0,
  maxBackoffMs: 0,
  timeoutMs: 1_000,
};

/** カバー応答の差し替え。省略時は実在するJPEG、failはカバー取得失敗（先取りに失敗してキャッシュに残らない） */
type CoverTransport = Uint8Array | "fail" | undefined;

function coverTransport(cover: CoverTransport, fallback: Uint8Array) {
  return () =>
    cover === "fail" ? new Response("error", { status: 500 }) : jpegResponse(cover ?? fallback);
}

async function setup(t: TestContext, cover?: CoverTransport) {
  const lib = makeSampleLibrary();
  const outside = makeTestDirectory("dlsite-cover-outside");
  t.after(lib.cleanup);
  t.after(outside.cleanup);
  const coverBody = new Uint8Array(
    readFileSync(join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg")),
  );
  const adapter = lib.own(
    createTestRealAdapter({
      database: { kind: "memory" },
      dlsiteRequestConfig: FAST_REQUESTS,
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) => htmlResponse(sampleWorkHtml(code, { cover: true })),
        cover: coverTransport(cover, coverBody),
      }),
    }),
  );
  await configureRoot(adapter, lib.root);
  await adapter.scan();
  const workId = lib.existingWorkId;
  const workDir = (await adapter.getWork(workId))!.physicalPath;
  const rjCode = (await adapter.getWork(workId))!.dlsite.rjCode!;
  const fetched = await adapter.dlsiteFetchByCode(rjCode);
  assert.equal(fetched.ok, true);

  const applyBody = async () =>
    ({
      info: (fetched as Extract<typeof fetched, { ok: true }>).info,
      applyTitle: false,
      applyTags: [],
      applyCover: true,
      applyUrl: true,
      sourceRevision: (await adapter.getWorkEditSnapshot(workId))!.sourceRevision,
    }) satisfies DlsiteApplyBody;

  return { adapter, workId, workDir, outside, coverBody, applyBody };
}

const coverFilesIn = (dir: string) => readdirSync(dir).filter((name) => /dlsite_cover/.test(name));

test("revision不一致では既存カバーが変わらず、一時ファイルも残らない", async (t) => {
  const { adapter, workId, workDir, applyBody } = await setup(t);
  const finalPath = join(workDir, "dlsite_cover.jpg");
  writeFileSync(finalPath, SENTINEL);
  const body = await applyBody();
  await adapter.patchWorkSource(workId, {
    sourceRevision: body.sourceRevision,
    title: "別の編集",
  });

  await assert.rejects(() => adapter.dlsiteApply(workId, body), SourceChangedError);
  assert.deepEqual(readFileSync(finalPath), SENTINEL);
  assert.deepEqual(coverFilesIn(workDir), ["dlsite_cover.jpg"]);
});

test("最終名がルート外を指すsymlinkでも、外部ファイルは変わらず通常ファイルに置き換わる", async (t) => {
  const { adapter, workId, workDir, outside, coverBody, applyBody } = await setup(t);
  const target = join(outside.path, "victim.txt");
  writeFileSync(target, SENTINEL);
  const finalPath = join(workDir, "dlsite_cover.jpg");
  symlinkSync(target, finalPath);

  const result = await adapter.dlsiteApply(workId, await applyBody());
  assert.ok(result);
  assert.deepEqual(readFileSync(target), SENTINEL);
  assert.equal(lstatSync(finalPath).isSymbolicLink(), false);
  assert.deepEqual(readFileSync(finalPath), Buffer.from(coverBody));
  assert.deepEqual(coverFilesIn(workDir), ["dlsite_cover.jpg"]);
});

test("作品フォルダーがルート外を指すsymlinkなら、カバーを書かない", async (t) => {
  const { adapter, workId, workDir, outside, applyBody } = await setup(t);
  const moved = join(outside.path, "moved-work");
  renameSync(workDir, moved);
  symlinkSync(moved, workDir);

  await assert.rejects(async () => adapter.dlsiteApply(workId, await applyBody()), CoverSaveError);
  assert.deepEqual(coverFilesIn(moved), []);
});

test("画像として判定できないキャッシュのカバーは書かない", async (t) => {
  const { adapter, workId, workDir, applyBody } = await setup(t, NOT_AN_IMAGE);
  await assert.rejects(async () => adapter.dlsiteApply(workId, await applyBody()), CoverSaveError);
  assert.deepEqual(coverFilesIn(workDir), []);
});

test("カバーの拡張子はURLではなく画像の中身で決まる", async (t) => {
  const png = new Uint8Array(
    await sharp({ create: { width: 3, height: 2, channels: 3, background: "#fff" } })
      .png()
      .toBuffer(),
  );
  const { adapter, workId, workDir, applyBody } = await setup(t, png);
  const result = await adapter.dlsiteApply(workId, await applyBody());
  assert.ok(result);
  assert.equal(result.snapshot.coverImage, "dlsite_cover.png");
  assert.ok(existsSync(join(workDir, "dlsite_cover.png")));
  assert.deepEqual(coverFilesIn(workDir), ["dlsite_cover.png"]);
});

const REGISTER_FOLDER = "RJ900020_manual";

const REGISTER_CODE = "RJ900020";

async function setupRegistration(t: TestContext, cover?: CoverTransport) {
  const dir = makeTestDirectory("dlsite-cover-register");
  t.after(dir.cleanup);
  const root = join(dir.path, "lib");
  const folder = join(root, REGISTER_FOLDER);
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "intro.wav"), 1);
  const adapter = dir.own(
    createTestRealAdapter({
      database: { kind: "memory" },
      dlsiteRequestConfig: FAST_REQUESTS,
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) => htmlResponse(sampleWorkHtml(code, { cover: true })),
        cover: coverTransport(
          cover,
          new Uint8Array(Buffer.from(SAMPLE_COVER_JPEG_BASE64, "base64")),
        ),
      }),
    }),
  );
  await configureRoot(adapter, root);
  assert.equal((await adapter.dlsiteFetchByCode(REGISTER_CODE)).ok, true);
  const app = createApp(adapter);
  const register = (path = REGISTER_FOLDER) =>
    app.request("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        title: "登録",
        rjCode: REGISTER_CODE,
        applyCover: true,
        applyUrl: false,
      }),
    });
  return { folder, register, root };
}

test("新規登録はapplyCoverでカバーをdlsite_cover.<ext>に確定する", async (t) => {
  const { folder, register } = await setupRegistration(t);
  const res = await register();
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.snapshot.coverImage, "dlsite_cover.jpg");
  assert.deepEqual(coverFilesIn(folder), ["dlsite_cover.jpg"]);
});

test("孤立メタの復元でもカバーを確定する", async (t) => {
  const png = new Uint8Array(
    await sharp({ create: { width: 3, height: 2, channels: 3, background: "#fff" } })
      .png()
      .toBuffer(),
  );
  const { folder, register } = await setupRegistration(t, png);
  writeMetaFile(join(folder, META_FILE_NAME), {
    formatVersion: 1,
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    title: "復元前",
    urls: [],
    tags: nts([]),
    coverImage: null,
    playlists: [],
    defaultPlaylistId: null,
    createdAt: new Date().toISOString(),
    dlsite: emptyMetaDlsiteState(),
  });
  const res = await register();
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.snapshot.id, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  assert.equal(body.snapshot.coverImage, "dlsite_cover.png");
  assert.deepEqual(coverFilesIn(folder), ["dlsite_cover.png"]);
});

test("登録が失敗しても一時ファイルは残らない", async (t) => {
  const { folder, register } = await setupRegistration(t);
  assert.equal((await register()).status, 201);
  assert.equal((await register()).status, 409);
  assert.deepEqual(coverFilesIn(folder), ["dlsite_cover.jpg"]);

  const blocked = await setupRegistration(t);
  mkdirSync(join(blocked.folder, "dlsite_cover.jpg"));
  assert.equal((await blocked.register()).status, 502);
  assert.deepEqual(coverFilesIn(blocked.folder), ["dlsite_cover.jpg"]);
  assert.ok(lstatSync(join(blocked.folder, "dlsite_cover.jpg")).isDirectory());
});

test("カバーがキャッシュに無いとき、登録はカバーなしで成功し、適用は取り直さず502 errorになる", async (t) => {
  const { folder, register } = await setupRegistration(t, "fail");
  const res = await register();
  assert.equal(res.status, 201);
  assert.equal((await res.json()).snapshot.coverImage, null);
  assert.deepEqual(coverFilesIn(folder), []);

  const { adapter, workId, applyBody } = await setup(t, "fail");
  const apply = await createApp(adapter).request(`/api/dlsite/${workId}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await applyBody()),
  });
  assert.equal(apply.status, 502);
  assert.equal((await apply.json()).error.code, "error");
});

const canDenyWrites = process.platform !== "win32" && process.getuid?.() !== 0;

test(
  "作業フォルダーが書き込み不可で一時ファイルを作れないときも、登録と適用は502 errorになる",
  { skip: !canDenyWrites },
  async (t) => {
    const registration = await setupRegistration(t);
    chmodSync(registration.folder, 0o555);
    t.after(() => chmodSync(registration.folder, 0o755));
    const res = await registration.register();
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error.code, "error");

    const { adapter, workId, workDir, applyBody } = await setup(t);
    chmodSync(workDir, 0o555);
    t.after(() => chmodSync(workDir, 0o755));
    const apply = await createApp(adapter).request(`/api/dlsite/${workId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await applyBody()),
    });
    assert.equal(apply.status, 502);
    assert.equal((await apply.json()).error.code, "error");
  },
);
