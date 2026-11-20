// 追加（候補・Filesの作品登録）はキャッシュだけを読み、DLsiteへHTTPを出さない（ADR-0033）。
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spyOn } from "bun:test";
import { test, type TestContext } from "node:test";
import { Scanner } from "../../src/adapters/real/scanner.ts";
import {
  emptyMetaDlsiteState,
  META_FILE_NAME,
  SCAN_CANDIDATE_REGISTER_MAX_PATHS,
} from "@mimimilli/shared";
import { writeMetaFile } from "../../src/adapters/real/meta.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../../src/adapters/real/dlsiteConfig.ts";
import {
  htmlResponse,
  jpegResponse,
  mockDlsiteTransport,
  sampleWorkHtml,
} from "../helpers/dlsiteTransport.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { configureRoot } from "../helpers/rootFolder.ts";
import { makeTestDirectory, SAMPLE_COVER_JPEG_BASE64, writeWav } from "../helpers/sampleLibrary.ts";
import { nts } from "../helpers/tag.ts";
import { createApp } from "../helpers/testApp.ts";
import { runScan, listCandidates, registerCandidates } from "../helpers/scanLibrary.ts";

const CODE = "RJ900100";
const CANDIDATE = "候補フォルダー";
const FILES_DIR = "Files作品";
const OK_TTL_MS = 1_000;
const SAMPLE_COVER = new Uint8Array(Buffer.from(SAMPLE_COVER_JPEG_BASE64, "base64"));
const ALL = { title: true, cover: true, tags: true, url: true };

interface Options {
  coverFails?: boolean;
  html?: (code: string) => Response;
}

async function setup(t: TestContext, options: Options = {}) {
  const directory = makeTestDirectory("registration-no-http");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  for (const name of [CANDIDATE, FILES_DIR]) {
    mkdirSync(join(root, name), { recursive: true });
    writeWav(join(root, name, "track.wav"), 1);
  }
  const counts = { html: 0, cover: 0 };
  const control = { now: 10_000, htmlStatus: 200 };
  const adapter = directory.own(
    createTestRealAdapter({
      database: { kind: "memory" },
      dlsiteCache: {
        path: join(directory.path, "cache.sqlite"),
        ttlsMs: { ok: OK_TTL_MS },
        clock: () => control.now,
      },
      dlsiteRequestConfig: {
        ...DEFAULT_DLSITE_REQUEST_CONFIG,
        requestIntervalMs: 0,
        retryCount: 0,
        maxBackoffMs: 0,
        timeoutMs: 1_000,
      },
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) => {
          counts.html += 1;
          if (control.htmlStatus !== 200) return htmlResponse("error", control.htmlStatus);
          return (
            options.html?.(code) ??
            htmlResponse(sampleWorkHtml(code, { title: `タイトル${code}`, cover: true }))
          );
        },
        cover: () => {
          counts.cover += 1;
          return options.coverFails
            ? new Response("error", { status: 500 })
            : jpegResponse(SAMPLE_COVER);
        },
      }),
    }),
  );
  const app = createApp(adapter);
  await configureRoot(adapter, root);
  await runScan(adapter);
  const post = (path: string, body: unknown) =>
    app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const registerCandidate = async () => {
    const response = await post("/api/scan/candidates/rj-code", { path: CANDIDATE, rjCode: CODE });
    assert.equal(response.status, 200);
    const registered = await post("/api/scan/candidates/register", {
      paths: [CANDIDATE],
      apply: ALL,
    });
    assert.equal(registered.status, 201);
    const { registered: entries } = await registered.json();
    return (await (await app.request(`/api/works/${entries[0].workId}`)).json()) as {
      title: string;
      cover: unknown;
      tags: string[];
      urls: unknown[];
      dlsite: { status: string; rjCode: string | null };
    };
  };
  const registerFiles = async () => {
    const response = await post("/api/works", {
      path: FILES_DIR,
      title: "手入力",
      rjCode: CODE,
      applyCover: true,
      applyUrl: true,
    });
    assert.equal(response.status, 201);
    const created = await response.json();
    return (await (await app.request(`/api/works/${created.snapshot.id}`)).json()) as {
      title: string;
      cover: unknown;
      urls: unknown[];
      dlsite: { status: string };
    };
  };
  return { adapter, root, counts, control, registerCandidate, registerFiles };
}

test("追加はキャッシュだけを読み、候補・Filesのどちらもtransportを呼ばない", async (t) => {
  const subject = await setup(t);
  assert.equal((await subject.adapter.dlsiteFetchByCode(CODE)).ok, true);
  const before = { ...subject.counts };
  assert.equal(before.cover, 1);

  const candidate = await subject.registerCandidate();
  assert.equal(candidate.title, `タイトル${CODE}`);
  assert.ok(candidate.cover);
  assert.deepEqual(subject.counts, before);

  const files = await subject.registerFiles();
  assert.equal(files.title, "手入力");
  assert.ok(files.cover);
  assert.equal(files.urls.length, 1);
  assert.deepEqual(subject.counts, before);
});

test("カバーの先取りに失敗していても、カバー以外を反映して追加し、取り直さない", async (t) => {
  const subject = await setup(t, { coverFails: true });
  assert.equal((await subject.adapter.dlsiteFetchByCode(CODE)).ok, true);
  const before = { ...subject.counts };

  const candidate = await subject.registerCandidate();
  assert.equal(candidate.title, `タイトル${CODE}`);
  assert.equal(candidate.cover ?? null, null);
  assert.equal(candidate.urls.length, 1);
  assert.equal(candidate.dlsite.status, "applied");

  const files = await subject.registerFiles();
  assert.equal(files.cover ?? null, null);
  assert.equal(files.urls.length, 1);
  assert.deepEqual(subject.counts, before);
});

const unusableCases: Array<{
  name: string;
  options?: Options;
  prepare(subject: Awaited<ReturnType<typeof setup>>): Promise<void>;
}> = [
  {
    name: "TTL切れ",
    async prepare(subject) {
      assert.equal((await subject.adapter.dlsiteFetchByCode(CODE)).ok, true);
      subject.control.now += OK_TTL_MS + 1;
    },
  },
  {
    name: "TTL切れのあとの取得失敗の記録",
    async prepare(subject) {
      assert.equal((await subject.adapter.dlsiteFetchByCode(CODE)).ok, true);
      subject.control.now += OK_TTL_MS + 1;
      subject.control.htmlStatus = 500;
      assert.equal((await subject.adapter.dlsiteFetchByCode(CODE)).ok, false);
    },
  },
  {
    name: "解析できないsnapshot（parse_error）",
    options: { html: () => htmlResponse("<html><body>no product</body></html>") },
    async prepare(subject) {
      assert.equal((await subject.adapter.dlsiteFetchByCode(CODE)).ok, false);
    },
  },
  {
    name: "キャッシュに無い",
    async prepare() {},
  },
];

for (const { name, options, prepare } of unusableCases) {
  test(`DLsite情報が使えない（${name}）候補とFilesは、フォルダー名・入力のまま追加され、HTTPを出さない`, async (t) => {
    const subject = await setup(t, options);
    await prepare(subject);
    const before = { ...subject.counts };

    const candidate = await subject.registerCandidate();
    assert.equal(candidate.title, CANDIDATE);
    assert.deepEqual(candidate.tags, []);
    assert.equal(candidate.cover ?? null, null);
    assert.equal(candidate.urls.length, 0);
    assert.notEqual(candidate.dlsite.status, "applied");
    assert.equal(candidate.dlsite.rjCode, CODE);

    const files = await subject.registerFiles();
    assert.equal(files.title, "手入力");
    assert.equal(files.cover ?? null, null);
    assert.equal(files.urls.length, 0);
    assert.notEqual(files.dlsite.status, "applied");
    assert.deepEqual(subject.counts, before);
  });
}

test("孤立メタの復元は、DLsite情報が使えるときだけ連携状態を更新し、使えないときはメタの連携状態を残す", async (t) => {
  const subject = await setup(t);
  const metaPath = join(subject.root, FILES_DIR, META_FILE_NAME);
  const writeOrphan = () =>
    writeMetaFile(metaPath, {
      formatVersion: 1,
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      title: "復元前",
      urls: [],
      tags: nts([]),
      coverImage: null,
      playlists: [],
      defaultPlaylistId: null,
      createdAt: new Date().toISOString(),
      dlsite: { ...emptyMetaDlsiteState(), rjCode: "RJ900101", status: "skipped" },
    });
  const restore = () =>
    createApp(subject.adapter).request("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: FILES_DIR,
        title: "復元後",
        rjCode: CODE,
        applyCover: false,
        applyUrl: false,
      }),
    });
  const dlsiteOfMeta = () =>
    (JSON.parse(readFileSync(metaPath, "utf-8")) as { dlsite: { rjCode: string; status: string } })
      .dlsite;

  writeOrphan();
  assert.equal((await restore()).status, 201);
  assert.deepEqual(
    { rjCode: dlsiteOfMeta().rjCode, status: dlsiteOfMeta().status },
    { rjCode: "RJ900101", status: "skipped" },
  );

  const second = await setup(t);
  assert.equal((await second.adapter.dlsiteFetchByCode(CODE)).ok, true);
  const secondMetaPath = join(second.root, FILES_DIR, META_FILE_NAME);
  writeFileSync(secondMetaPath, readFileSync(metaPath));
  const response = await createApp(second.adapter).request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: FILES_DIR,
      title: "復元後",
      rjCode: CODE,
      applyCover: false,
      applyUrl: false,
    }),
  });
  assert.equal(response.status, 201);
  const restored = JSON.parse(readFileSync(secondMetaPath, "utf-8")) as {
    dlsite: { rjCode: string; status: string };
  };
  assert.deepEqual(
    { rjCode: restored.dlsite.rjCode, status: restored.dlsite.status },
    { rjCode: CODE, status: "applied" },
  );
});

test("上限を超える件数の候補は、分割した追加で全件が作品になり、DLsite情報つきでも通信しない", async (t) => {
  const directory = makeTestDirectory("registration-chunks");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const total = SCAN_CANDIDATE_REGISTER_MAX_PATHS + 5;
  const folders = Array.from(
    { length: total },
    (_, index) => `RJ9003${String(index).padStart(2, "0")}_作品${index}`,
  );
  for (const name of folders) {
    mkdirSync(join(root, name), { recursive: true });
    writeWav(join(root, name, "track.wav"), 1);
  }
  const counts = { html: 0, cover: 0 };
  const adapter = directory.own(
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
        html: (code) => {
          counts.html += 1;
          return htmlResponse(sampleWorkHtml(code, { title: `タイトル${code}`, cover: true }));
        },
        cover: () => {
          counts.cover += 1;
          return jpegResponse(SAMPLE_COVER);
        },
      }),
    }),
  );
  await configureRoot(adapter, root);
  await runScan(adapter);
  const detected = (await listCandidates(adapter)).map((candidate) => candidate.rjCode);
  assert.equal(detected.length, total);
  for (const code of detected) assert.equal((await adapter.dlsiteFetchByCode(code!)).ok, true);
  const before = { ...counts };

  const paths = (await listCandidates(adapter)).map((candidate) => candidate.path);
  const registered = new Set<string>();
  for (let start = 0; start < paths.length; start += SCAN_CANDIDATE_REGISTER_MAX_PATHS) {
    const result = await registerCandidates(
      adapter,
      paths.slice(start, start + SCAN_CANDIDATE_REGISTER_MAX_PATHS),
      ALL,
    );
    assert.deepEqual(result.failures, []);
    for (const entry of result.registered) registered.add(entry.path);
  }
  assert.equal(registered.size, total);
  assert.deepEqual(counts, before);
  assert.deepEqual(await listCandidates(adapter), []);
});

test("候補の一括追加で一部が失敗しても、失敗した候補にカバーが残らない", async (t) => {
  const directory = makeTestDirectory("registration-failure-cover");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const folders = ["RJ900201_成功", "RJ900202_失敗"];
  for (const name of folders) {
    mkdirSync(join(root, name), { recursive: true });
    writeWav(join(root, name, "track.wav"), 1);
  }
  const adapter = directory.own(
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
        html: (code) => htmlResponse(sampleWorkHtml(code, { cover: true })),
        cover: () => jpegResponse(SAMPLE_COVER),
      }),
    }),
  );
  await configureRoot(adapter, root);
  await runScan(adapter);
  for (const code of ["RJ900201", "RJ900202"]) {
    assert.equal((await adapter.dlsiteFetchByCode(code)).ok, true);
  }
  const original = Scanner.prototype.writeNewWorkMeta;
  const writing = spyOn(Scanner.prototype, "writeNewWorkMeta").mockImplementation(
    function (this: Scanner, target, options) {
      if (target.physicalPath.endsWith("RJ900202_失敗")) throw new Error("メタを書けません");
      return original.call(this, target, options);
    },
  );
  t.after(() => writing.mockRestore());

  const result = await registerCandidates(
    adapter,
    (await listCandidates(adapter)).map((candidate) => candidate.path),
    ALL,
  );
  assert.equal(result.registered.length, 1);
  assert.equal(result.failures.length, 1);
  assert.ok(existsSync(join(root, "RJ900201_成功", "dlsite_cover.jpg")));
  assert.equal(existsSync(join(root, "RJ900202_失敗", "dlsite_cover.jpg")), false);
});
