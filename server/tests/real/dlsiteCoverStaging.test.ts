import assert from "node:assert/strict";
import {
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
import { emptyMetaDlsiteState, META_FILE_NAME, type DlsiteApplyBody } from "@mimimilli/shared";
import { CoverSaveError, SourceChangedError } from "../../src/errors.ts";
import { createApp } from "../../src/app.ts";
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

const COVER_URL = "https://img.dlsite.jp/modpub/images2/work/a.jpg";
const SENTINEL = Buffer.from("sentinel-not-an-image");

async function setup(t: TestContext, coverExtension = "jpg") {
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
      dlsiteRequestConfig: {
        ...DEFAULT_DLSITE_REQUEST_CONFIG,
        requestIntervalMs: 0,
        retryCount: 0,
        maxBackoffMs: 0,
        timeoutMs: 1_000,
      },
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) =>
          htmlResponse(
            sampleWorkHtml(code, { cover: true }).replace('.jpg"', `.${coverExtension}"`),
          ),
        cover: () => jpegResponse(coverBody),
      }),
    }),
  );
  await configureRoot(adapter, lib.root);
  await adapter.scan();
  const workId = lib.existingWorkId;
  const workDir = (await adapter.getWork(workId))!.physicalPath;

  const applyBody = async (overrides: Partial<DlsiteApplyBody["info"]> = {}) =>
    ({
      info: {
        rjCode: "RJ900002",
        title: "x",
        circle: null,
        cvs: [],
        genreTags: [],
        ageRating: null,
        coverUrl: COVER_URL,
        url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900002.html",
        ...overrides,
      },
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

test("許可リスト外の拡張子ではカバーを書かない", async (t) => {
  const { adapter, workId, workDir, applyBody } = await setup(t);
  for (const name of ["a.svg", "a.php", "a", "a.jpg.php"]) {
    await assert.rejects(
      async () =>
        adapter.dlsiteApply(
          workId,
          await applyBody({ coverUrl: `https://img.dlsite.jp/modpub/images2/work/${name}` }),
        ),
      CoverSaveError,
      name,
    );
    assert.deepEqual(coverFilesIn(workDir), [], name);
  }
});

test("許可リスト内の拡張子は固定のbasenameで確定する", async (t) => {
  const { adapter, workId, workDir, applyBody } = await setup(t);
  const result = await adapter.dlsiteApply(
    workId,
    await applyBody({ coverUrl: "https://img.dlsite.jp/modpub/images2/work/a.JPEG" }),
  );
  assert.ok(result);
  assert.equal(result.snapshot.coverImage, "dlsite_cover.jpeg");
  assert.ok(existsSync(join(workDir, "dlsite_cover.jpeg")));
  assert.deepEqual(coverFilesIn(workDir), ["dlsite_cover.jpeg"]);
});

test("apply-missingも一時ファイル経由で確定し、許可リスト外の画像は書かない", async (t) => {
  const rejected = await setup(t, "svg");
  assert.deepEqual(await rejected.adapter.dlsiteApplyMissing([rejected.workId]), {
    applied: 0,
    pending: 0,
    skipped: 1,
    failed: 0,
  });
  assert.deepEqual(coverFilesIn(rejected.workDir), []);

  const accepted = await setup(t);
  assert.deepEqual(await accepted.adapter.dlsiteApplyMissing([accepted.workId]), {
    applied: 1,
    pending: 0,
    skipped: 0,
    failed: 0,
  });
  assert.deepEqual(coverFilesIn(accepted.workDir), ["dlsite_cover.jpg"]);
});

const REGISTER_FOLDER = "RJ900020_manual";

async function setupRegistration(t: TestContext, coverExtension = "jpg") {
  const dir = makeTestDirectory("dlsite-cover-register");
  t.after(dir.cleanup);
  const root = join(dir.path, "lib");
  const folder = join(root, REGISTER_FOLDER);
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "intro.wav"), 1);
  const adapter = dir.own(
    createTestRealAdapter({
      database: { kind: "memory" },
      dlsiteRequestConfig: {
        ...DEFAULT_DLSITE_REQUEST_CONFIG,
        requestIntervalMs: 0,
        retryCount: 0,
        maxBackoffMs: 0,
        timeoutMs: 1_000,
      },
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        cover: () => jpegResponse(new Uint8Array(Buffer.from(SAMPLE_COVER_JPEG_BASE64, "base64"))),
      }),
    }),
  );
  await configureRoot(adapter, root);
  const app = createApp(adapter);
  const register = (path = REGISTER_FOLDER) =>
    app.request("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        title: "登録",
        dlsite: {
          info: {
            rjCode: "RJ900020",
            title: "x",
            circle: null,
            cvs: [],
            genreTags: [],
            ageRating: null,
            coverUrl: `https://img.dlsite.jp/modpub/images2/work/a.${coverExtension}`,
            url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900020.html",
          },
          applyTitle: false,
          applyTags: [],
          applyCover: true,
          applyUrl: false,
        },
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
  const { folder, register } = await setupRegistration(t, "png");
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

test("カバー保存の失敗は登録と適用で同じ扱い(502 error)になる", async (t) => {
  const { register } = await setupRegistration(t, "svg");
  const res = await register();
  assert.equal(res.status, 502);
  assert.deepEqual((await res.json()).error, {
    code: "error",
    message: "DLsiteカバーの保存に失敗しました",
  });

  const { adapter, workId, applyBody } = await setup(t);
  const apply = await createApp(adapter).request(`/api/dlsite/${workId}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      await applyBody({ coverUrl: "https://img.dlsite.jp/modpub/images2/work/a.svg" }),
    ),
  });
  assert.equal(apply.status, 502);
  assert.equal((await apply.json()).error.code, "error");
});
