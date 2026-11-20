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
import { spyOn } from "bun:test";
import { test, type TestContext } from "node:test";
import { Scanner } from "../../src/adapters/real/scanner.ts";
import sharp from "sharp";
import {
  emptyMetaDlsiteState,
  META_FILE_NAME,
  workPlacementOf,
  type DlsiteApplyBodyInput,
} from "@mimimilli/shared";
import { saveWithDlsiteCover } from "../../src/adapters/real/dlsiteCoverStaging.ts";
import { SourceChangedError } from "../../src/errors.ts";
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
import { fetchDlsiteForWork } from "../helpers/dlsiteApply.ts";
import { configureRoot } from "../helpers/rootFolder.ts";
import {
  makeSampleLibrary,
  makeTestDirectory,
  SAMPLE_COVER_JPEG_BASE64,
  writeWav,
} from "../helpers/sampleLibrary.ts";
import { runScan } from "../helpers/scanLibrary.ts";

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
  await runScan(adapter);
  const workId = lib.existingWorkId;
  const workDir = (await adapter.getWork(workId))!.physicalPath;
  const rjCode = (await adapter.getWork(workId))!.dlsite.rjCode!;
  const fetched = await fetchDlsiteForWork(adapter, workId, rjCode);

  const applyBody = async () =>
    ({
      sourceRevision: (await adapter.getWorkEditSnapshot(workId))!.sourceRevision,
      infoRevision: fetched.infoRevision,
      apply: { title: false, cover: true, url: true, tags: [] },
    }) satisfies DlsiteApplyBodyInput;

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

test("作品フォルダーがルート外を指すsymlinkなら、ルート外にカバーを書かない", async (t) => {
  const { adapter, workId, workDir, outside, applyBody } = await setup(t);
  const moved = join(outside.path, "moved-work");
  renameSync(workDir, moved);
  symlinkSync(moved, workDir);

  const result = await adapter.dlsiteApply(workId, await applyBody());
  assert.ok(result);
  assert.equal(result.snapshot.coverImage, null);
  assert.equal(result.coverSkipped, "outside_root");
  assert.deepEqual(coverFilesIn(moved), []);
});

test("画像として判定できないキャッシュのカバーは書かず、ほかの項目は反映する", async (t) => {
  const { adapter, workId, workDir, applyBody } = await setup(t, NOT_AN_IMAGE);
  const result = await adapter.dlsiteApply(workId, await applyBody());
  assert.ok(result);
  assert.equal(result.snapshot.coverImage, null);
  assert.equal(result.snapshot.dlsite.status, "applied");
  assert.equal(result.coverSkipped, "unreadable");
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
  assert.equal(result.coverSkipped, null);
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

test("カバーがキャッシュに無いとき、登録も適用もカバーなしで成功し、適用はほかの項目を反映する", async (t) => {
  const { folder, register } = await setupRegistration(t, "fail");
  const res = await register();
  assert.equal(res.status, 201);
  const registered = await res.json();
  assert.equal(registered.snapshot.coverImage, null);
  assert.equal(registered.coverSkipped, "not_cached");
  assert.deepEqual(coverFilesIn(folder), []);

  const { adapter, workId, workDir, applyBody } = await setup(t, "fail");
  const apply = await createApp(adapter).request(`/api/dlsite/${workId}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await applyBody()),
  });
  assert.equal(apply.status, 200);
  const { snapshot, coverSkipped } = await apply.json();
  assert.equal(coverSkipped, "not_cached");
  assert.equal(snapshot.coverImage, null);
  assert.equal(snapshot.dlsite.status, "applied");
  assert.equal(snapshot.urls.length, 1);
  assert.deepEqual(coverFilesIn(workDir), []);
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

async function solidImage(color: string): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({ create: { width: 4, height: 4, channels: 3, background: color } })
      .jpeg()
      .toBuffer(),
  );
}

test("同じフォルダーの単一ファイル作品は、それぞれ別名のカバーを持ち、互いに上書きしない", async (t) => {
  const dir = makeTestDirectory("dlsite-cover-pair");
  t.after(dir.cleanup);
  const root = join(dir.path, "lib");
  const folder = join(root, "pair");
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "a.wav"), 1);
  writeWav(join(folder, "b.wav"), 1);
  const red = await solidImage("#ff0000");
  const blue = await solidImage("#0000ff");
  const adapter = dir.own(
    createTestRealAdapter({
      database: { kind: "memory" },
      dlsiteRequestConfig: FAST_REQUESTS,
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) => htmlResponse(sampleWorkHtml(code, { cover: true })),
        cover: (url) => jpegResponse(url.includes("RJ900031") ? red : blue),
      }),
    }),
  );
  await configureRoot(adapter, root);
  const app = createApp(adapter);
  const register = async (file: string, rjCode: string) => {
    assert.equal((await adapter.dlsiteFetchByCode(rjCode)).ok, true);
    const res = await app.request("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `pair/${file}`,
        title: file,
        rjCode,
        applyCover: true,
        applyUrl: false,
      }),
    });
    assert.equal(res.status, 201);
    return (await res.json()).snapshot as { id: string; coverImage: string | null };
  };
  const a = await register("a.wav", "RJ900031");
  const b = await register("b.wav", "RJ900032");

  assert.equal(a.coverImage, "a.dlsite_cover.jpg");
  assert.equal(b.coverImage, "b.dlsite_cover.jpg");
  assert.deepEqual(coverFilesIn(folder).sort(), ["a.dlsite_cover.jpg", "b.dlsite_cover.jpg"]);
  assert.deepEqual(readFileSync(join(folder, "a.dlsite_cover.jpg")), Buffer.from(red));
  assert.deepEqual(readFileSync(join(folder, "b.dlsite_cover.jpg")), Buffer.from(blue));

  const fetched = await fetchDlsiteForWork(adapter, a.id, "RJ900031");
  const applied = await adapter.dlsiteApply(a.id, {
    sourceRevision: (await adapter.getWorkEditSnapshot(a.id))!.sourceRevision,
    infoRevision: fetched.infoRevision,
    apply: { title: false, cover: true, url: false, tags: [] },
  });
  assert.equal(applied?.snapshot.coverImage, "a.dlsite_cover.jpg");
  assert.deepEqual(readFileSync(join(folder, "a.dlsite_cover.jpg")), Buffer.from(red));
  assert.deepEqual(readFileSync(join(folder, "b.dlsite_cover.jpg")), Buffer.from(blue));
  assert.equal((await adapter.getWorkEditSnapshot(b.id))!.coverImage, "b.dlsite_cover.jpg");
});

const STAGING_COVER_URL =
  "https://img.dlsite.jp/modpub/images2/work/doujin/RJ900000/RJ900041_img_main.jpg";

async function stagingFixture(t: TestContext, placementMetaName: string) {
  const dir = makeTestDirectory("dlsite-cover-staging");
  t.after(dir.cleanup);
  const root = join(dir.path, "lib");
  mkdirSync(root, { recursive: true });
  const body = await solidImage("#00ff00");
  const source = {
    cache: { getCover: () => ({ body, contentType: "image/jpeg", fetchedAt: 1 }) },
    coverUrl: STAGING_COVER_URL,
  } as unknown as Parameters<typeof saveWithDlsiteCover>[0];
  return { root, body, source, placement: workPlacementOf(join(root, placementMetaName)) };
}

for (const [kind, metaName, coverName] of [
  ["フォルダー作品", META_FILE_NAME, "dlsite_cover.jpg"],
  ["単一ファイル作品", "a.mimimilli.json", "a.dlsite_cover.jpg"],
] as const) {
  test(`${kind}: メタ保存に失敗したら、配置した新しいカバーを消して旧カバーを戻す`, async (t) => {
    const { root, source, placement } = await stagingFixture(t, metaName);
    const finalPath = join(root, coverName);
    writeFileSync(finalPath, SENTINEL);
    await assert.rejects(
      () =>
        saveWithDlsiteCover(source, placement, root, (cover) => {
          assert.equal(cover?.fileName, coverName);
          cover?.place();
          assert.notDeepEqual(readFileSync(finalPath), SENTINEL);
          throw new Error("meta save failed");
        }),
      /meta save failed/,
    );
    assert.deepEqual(readFileSync(finalPath), SENTINEL);
    assert.deepEqual(readdirSync(root), [coverName]);
  });

  test(`${kind}: 旧カバーが無いときにメタ保存に失敗したら、新しいカバーも残らない`, async (t) => {
    const { root, source, placement } = await stagingFixture(t, metaName);
    await assert.rejects(
      () =>
        saveWithDlsiteCover(source, placement, root, (cover) => {
          cover?.place();
          throw new Error("meta save failed");
        }),
      /meta save failed/,
    );
    assert.deepEqual(readdirSync(root), []);
  });

  test(`${kind}: メタ保存に成功したら新しいカバーに置き換わり、退避も残らない`, async (t) => {
    const { root, body, source, placement } = await stagingFixture(t, metaName);
    const finalPath = join(root, coverName);
    writeFileSync(finalPath, SENTINEL);
    await saveWithDlsiteCover(source, placement, root, (cover) => cover?.place());
    assert.deepEqual(readFileSync(finalPath), Buffer.from(body));
    assert.deepEqual(readdirSync(root), [coverName]);
  });
}

test("自分の配置から導いた旧カバーが拡張子違いなら、保存に成功したあとで消す。旧固定名や他人のカバーは触らない", async (t) => {
  const { root, body, source, placement } = await stagingFixture(t, "a.mimimilli.json");
  writeFileSync(join(root, "a.dlsite_cover.png"), SENTINEL);
  writeFileSync(join(root, "dlsite_cover.png"), SENTINEL);
  writeFileSync(join(root, "user-cover.png"), SENTINEL);

  await assert.rejects(
    () =>
      saveWithDlsiteCover(
        { ...source, previousCoverImage: "a.dlsite_cover.png" },
        placement,
        root,
        (cover) => {
          cover?.place();
          throw new Error("meta save failed");
        },
      ),
    /meta save failed/,
  );
  assert.ok(existsSync(join(root, "a.dlsite_cover.png")));

  await saveWithDlsiteCover(
    { ...source, previousCoverImage: "a.dlsite_cover.png" },
    placement,
    root,
    (cover) => cover?.place(),
  );
  assert.deepEqual(readFileSync(join(root, "a.dlsite_cover.jpg")), Buffer.from(body));
  assert.equal(existsSync(join(root, "a.dlsite_cover.png")), false);
  assert.ok(existsSync(join(root, "dlsite_cover.png")));

  await saveWithDlsiteCover(
    { ...source, previousCoverImage: "dlsite_cover.png" },
    placement,
    root,
    (cover) => cover?.place(),
  );
  await saveWithDlsiteCover(
    { ...source, previousCoverImage: "user-cover.png" },
    placement,
    root,
    (cover) => cover?.place(),
  );
  assert.ok(existsSync(join(root, "dlsite_cover.png")));
  assert.ok(existsSync(join(root, "user-cover.png")));
});

test("登録の投影が失敗しても、メタが指す新しいカバーは消えない", async (t) => {
  const { folder, register } = await setupRegistration(t);
  const projection = spyOn(Scanner.prototype, "projectPrepared").mockRejectedValue(
    new Error("projection failed"),
  );
  t.after(() => projection.mockRestore());
  const res = await register();
  assert.notEqual(res.status, 201);
  assert.deepEqual(coverFilesIn(folder), ["dlsite_cover.jpg"]);
  const meta = JSON.parse(readFileSync(join(folder, META_FILE_NAME), "utf-8"));
  assert.equal(meta.coverImage, "dlsite_cover.jpg");
});
