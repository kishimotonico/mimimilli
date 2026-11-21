// 候補一覧のDLsite状態・カバー配信・行方不明の付記の契約を、fixture と real の両方へ流す。
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  emptyDlsiteState,
  scanCandidateSchema,
  type ScanCandidate,
  type WorkSummary,
} from "@mimimilli/shared";
import type { DataAdapter } from "../src/adapter/index.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import {
  FIXTURE_DLSITE_FETCH_FAILURE_RJ_CODE,
  FIXTURE_DLSITE_NOT_FOUND_RJ_CODE,
  FIXTURE_DLSITE_NO_COVER_RJ_CODE,
} from "../src/adapters/fixture/dlsiteMethods.ts";
import { openDb } from "../src/adapters/real/db.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../src/adapters/real/dlsiteConfig.ts";
import { pollUntil } from "./helpers/poll.ts";
import {
  coverUrlFromRequest,
  htmlResponse,
  jpegResponse,
  mockDlsiteTransport,
  sampleWorkHtml,
} from "./helpers/dlsiteTransport.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { configureRoot } from "./helpers/rootFolder.ts";
import { makeTestDirectory, writeWav } from "./helpers/sampleLibrary.ts";
import { createApp } from "./helpers/testApp.ts";
import { folderFixtureWork } from "./helpers/workTestUtils.ts";
import { runScan } from "./helpers/scanLibrary.ts";

const TARGET = "未登録作品";
const OK_CODE = "RJ000001";
const MISSING_CODE = "RJ900031";
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3]);

interface Subject {
  kind: "fixture" | "real";
  adapter: DataAdapter;
  app: ReturnType<typeof createApp>;
  notFoundCode: string;
  errorCode: string;
  noCoverCode: string;
  /** 取得を保留していたら解放する */
  release(): void;
  dispose(): Promise<void>;
}

const MISSING_WORK_TITLE = "旧作品";
const OUTSIDE_CODE = "RJ900032";
const OUTSIDE_TITLE = "外の作品";

function missingFixtureWork(
  overrides: { id?: string; title?: string; physicalPath?: string; rjCode?: string } = {},
): WorkSummary {
  const title = overrides.title ?? MISSING_WORK_TITLE;
  const rjCode = overrides.rjCode ?? MISSING_CODE;
  return {
    id: overrides.id ?? "missing-work",
    title,
    cover: null,
    status: "missing",
    physicalPath: overrides.physicalPath ?? `/library/${rjCode}_${title}`,
    totalDurationSec: 0,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: { ...emptyDlsiteState(), rjCode },
  };
}

async function createSubject(
  kind: Subject["kind"],
  options: { hold?: boolean } = {},
): Promise<Subject> {
  if (kind === "fixture") {
    const adapter = createFixtureAdapter({
      scenario: "new-work",
      works: [
        folderFixtureWork(missingFixtureWork()),
        folderFixtureWork(
          missingFixtureWork({
            id: "outside-work",
            title: OUTSIDE_TITLE,
            rjCode: OUTSIDE_CODE,
            physicalPath: "/elsewhere/外の作品",
          }),
        ),
      ],
      dlsiteFetchDelayMs: options.hold ? 150 : 0,
    });
    await runScan(adapter);
    const app = createApp(adapter);
    return {
      kind,
      adapter,
      app,
      notFoundCode: FIXTURE_DLSITE_NOT_FOUND_RJ_CODE,
      errorCode: FIXTURE_DLSITE_FETCH_FAILURE_RJ_CODE,
      noCoverCode: FIXTURE_DLSITE_NO_COVER_RJ_CODE,
      release: () => {},
      dispose: () => app.shutdown(),
    };
  }
  const directory = makeTestDirectory("scan-candidates-dlsite");
  const catalogPath = join(directory.path, "catalog.db");
  const userPath = join(directory.path, "user.db");
  const root = join(directory.path, "library");
  mkdirSync(join(root, TARGET), { recursive: true });
  writeFileSync(join(root, TARGET, "a.mp3"), Buffer.alloc(16));
  const gate = Promise.withResolvers<void>();
  const adapter = directory.own(
    createTestRealAdapter({
      database: { kind: "files", catalogPath, userPath },
      dlsiteRequestConfig: {
        ...DEFAULT_DLSITE_REQUEST_CONFIG,
        requestIntervalMs: 0,
        retryCount: 0,
        maxBackoffMs: 0,
        timeoutMs: 1_000,
      },
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: async (code) => {
          if (options.hold) await gate.promise;
          if (code === "RJ000403") return htmlResponse("gone", 404);
          if (code === "RJ000404") return htmlResponse("error", 500);
          if (code === "RJ000402") {
            return htmlResponse(sampleWorkHtml(code, { title: `タイトル${code}`, cover: false }));
          }
          return htmlResponse(sampleWorkHtml(code, { title: `タイトル${code}` }));
        },
        cover: (url) =>
          coverUrlFromRequest(url) ? jpegResponse(JPEG_BYTES) : htmlResponse("", 404),
      }),
    }),
  );
  const app = createApp(adapter);
  await configureRoot(adapter, root);
  const missingDir = join(root, `${MISSING_CODE}_${MISSING_WORK_TITLE}`);
  mkdirSync(missingDir, { recursive: true });
  writeWav(join(missingDir, "track.wav"), 1);
  const registered = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `${MISSING_CODE}_${MISSING_WORK_TITLE}`,
      title: MISSING_WORK_TITLE,
      rjCode: MISSING_CODE,
      applyCover: false,
      applyUrl: false,
    }),
  });
  assert.equal(registered.status, 201);
  const missingId = ((await registered.json()) as { snapshot: { id: string } }).snapshot.id;
  const outsideDir = join(root, `${OUTSIDE_CODE}_${OUTSIDE_TITLE}`);
  mkdirSync(outsideDir, { recursive: true });
  writeWav(join(outsideDir, "track.wav"), 1);
  const outsideRegistered = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: `${OUTSIDE_CODE}_${OUTSIDE_TITLE}`,
      title: OUTSIDE_TITLE,
      rjCode: OUTSIDE_CODE,
      applyCover: false,
      applyUrl: false,
    }),
  });
  assert.equal(outsideRegistered.status, 201);
  const outsideId = ((await outsideRegistered.json()) as { snapshot: { id: string } }).snapshot.id;
  const db = openDb({ kind: "files", catalogPath, userPath });
  db.sqlite.run("UPDATE main.works SET status = 'missing' WHERE id = ?", [missingId]);
  db.sqlite.run("UPDATE main.works SET status = 'missing', physical_path = ? WHERE id = ?", [
    join(directory.path, "elsewhere", OUTSIDE_TITLE),
    outsideId,
  ]);
  db.close();
  await runScan(adapter);
  return {
    kind,
    adapter,
    app,
    notFoundCode: "RJ000403",
    errorCode: "RJ000404",
    noCoverCode: "RJ000402",
    release: () => gate.resolve(),
    dispose: async () => {
      gate.resolve();
      await app.shutdown();
      await directory.cleanup();
    },
  };
}

async function post(subject: Subject, path: string, body: unknown) {
  return subject.app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function setRjCode(subject: Subject, rjCode: string): Promise<ScanCandidate> {
  const response = await post(subject, "/api/scan/candidates/rj-code", { path: TARGET, rjCode });
  assert.equal(response.status, 200);
  return scanCandidateSchema.parse(((await response.json()) as { candidate: unknown }).candidate);
}

async function targetCandidate(subject: Subject): Promise<ScanCandidate> {
  const response = await subject.app.request("/api/scan/candidates");
  assert.equal(response.status, 200);
  const { candidates } = (await response.json()) as { candidates: unknown[] };
  const found = candidates
    .map((entry) => scanCandidateSchema.parse(entry))
    .find((entry) => entry.path === TARGET);
  assert.ok(found, "候補が見つかりません");
  return found;
}

async function startJob(subject: Subject, productCode: string): Promise<void> {
  const response = await post(subject, "/api/dlsite/jobs", { productCodes: [productCode] });
  assert.equal(response.status, 202);
}

async function waitJobFinished(subject: Subject): Promise<void> {
  await pollUntil(async () => {
    const { job } = (await (await subject.app.request("/api/dlsite/jobs/current")).json()) as {
      job: { status: string } | null;
    };
    return job?.status === "finished";
  });
}

async function fetchAndWait(subject: Subject, productCode: string): Promise<void> {
  await startJob(subject, productCode);
  await waitJobFinished(subject);
}

for (const kind of ["fixture", "real"] as const) {
  const contract = (name: string, run: (subject: Subject) => Promise<void>) =>
    test(`${name} (${kind})`, async () => {
      const subject = await createSubject(kind);
      try {
        await run(subject);
      } finally {
        await subject.dispose();
      }
    });

  contract("取得前の候補は未取得で、RJコードを直すと直したコードから導かれる", async (subject) => {
    assert.deepEqual((await targetCandidate(subject)).dlsite, { state: "none" });
    await fetchAndWait(subject, OK_CODE);
    assert.deepEqual((await setRjCode(subject, OK_CODE)).dlsite.state, "fetched");
    assert.deepEqual((await setRjCode(subject, "RJ000009")).dlsite, { state: "none" });
    assert.equal((await targetCandidate(subject)).dlsite.state, "none");
  });

  contract(
    "取得済みの候補はDLsiteのタイトルとカバーを持ち、カバーが配信される",
    async (subject) => {
      await fetchAndWait(subject, OK_CODE);
      await setRjCode(subject, OK_CODE);
      const { dlsite } = await targetCandidate(subject);
      assert.equal(dlsite.state, "fetched");
      if (dlsite.state !== "fetched") return;
      assert.ok(dlsite.title.length > 0);
      assert.ok(dlsite.cover, "カバーがキャッシュにあるはず");

      const url = `/api/media/dlsite-cover/${dlsite.cover.key}?v=${dlsite.cover.version}`;
      const response = await subject.app.request(url);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("Content-Type") ?? "", /^image\//);
      assert.equal(response.headers.get("Cache-Control"), "private, max-age=31536000, immutable");
      assert.ok((await response.arrayBuffer()).byteLength > 0);

      const unversioned = await subject.app.request(`/api/media/dlsite-cover/${dlsite.cover.key}`);
      assert.equal(unversioned.status, 200);
      const etag = unversioned.headers.get("ETag");
      assert.ok(etag);
      const revalidated = await subject.app.request(`/api/media/dlsite-cover/${dlsite.cover.key}`, {
        headers: { "If-None-Match": etag },
      });
      assert.equal(revalidated.status, 304);
    },
  );

  contract("カバーがキャッシュに無い取得済みの候補はcoverがnull", async (subject) => {
    await fetchAndWait(subject, subject.noCoverCode);
    const candidate = await setRjCode(subject, subject.noCoverCode);
    assert.equal(candidate.dlsite.state, "fetched");
    if (candidate.dlsite.state === "fetched") assert.equal(candidate.dlsite.cover, null);
  });

  contract("カバーの配信はキャッシュに無いキー・不正なキーを拒否する", async (subject) => {
    const missing = await subject.app.request(`/api/media/dlsite-cover/${"0".repeat(64)}`);
    assert.equal(missing.status, 404);
    const malformed = await subject.app.request("/api/media/dlsite-cover/not-a-key");
    assert.equal(malformed.status, 400);
  });

  contract("該当なしと取得失敗の候補は、それぞれnot_found・failed", async (subject) => {
    await fetchAndWait(subject, subject.notFoundCode);
    await fetchAndWait(subject, subject.errorCode);
    assert.deepEqual((await setRjCode(subject, subject.notFoundCode)).dlsite, {
      state: "not_found",
    });
    assert.deepEqual((await setRjCode(subject, subject.errorCode)).dlsite, { state: "failed" });
  });

  contract(
    "取得ジョブの終端の結果は、その直後の候補のdlsiteと一致し、候補のrevisionは終端以上になる",
    async (subject) => {
      for (const code of [OK_CODE, subject.noCoverCode, subject.notFoundCode, subject.errorCode]) {
        await startJob(subject, code);
        await waitJobFinished(subject);
        const state = (await (await subject.app.request("/api/dlsite/jobs/current")).json()) as {
          job: { codes: Array<{ productCode: string; revision: number; dlsite: unknown }> };
        };
        const terminal = state.job.codes.find((entry) => entry.productCode === code)!;
        const candidate = await setRjCode(subject, code);
        assert.deepEqual(candidate.dlsite, terminal.dlsite, code);
        assert.ok(candidate.dlsiteRevision >= terminal.revision, code);
      }
    },
  );

  contract("RJコードをなしに直した候補は、直す前の取得状態に関わらず未取得", async (subject) => {
    await fetchAndWait(subject, OK_CODE);
    await setRjCode(subject, OK_CODE);
    const cleared = await setRjCode(subject, "");
    assert.equal(cleared.rjCode, null);
    assert.deepEqual(cleared.dlsite, { state: "none" });
  });

  contract(
    "行方不明の作品と同じRJコードの候補に、その作品のID・タイトル・最後のパスが載る",
    async (subject) => {
      assert.deepEqual((await targetCandidate(subject)).missingWorks, []);
      const candidate = await setRjCode(subject, MISSING_CODE);
      assert.equal(candidate.missingWorks.length, 1);
      assert.equal(candidate.missingWorks[0]?.title, MISSING_WORK_TITLE);
      assert.equal(
        candidate.missingWorks[0]?.previousPath,
        `${MISSING_CODE}_${MISSING_WORK_TITLE}`,
      );
      assert.ok(candidate.missingWorks[0]?.workId);
      const listed = await targetCandidate(subject);
      assert.deepEqual(listed.missingWorks, candidate.missingWorks);
    },
  );

  contract("rootの外にあった行方不明の作品は、最後のパスが null になる", async (subject) => {
    const candidate = await setRjCode(subject, OUTSIDE_CODE);
    assert.equal(candidate.missingWorks.length, 1);
    assert.equal(candidate.missingWorks[0]?.title, OUTSIDE_TITLE);
    assert.equal(candidate.missingWorks[0]?.previousPath, null);
  });

  test(`取得中の候補はキャッシュどおり未取得で、終わると取得済みになる (${kind})`, async () => {
    const subject = await createSubject(kind, { hold: true });
    try {
      await setRjCode(subject, OK_CODE);
      await startJob(subject, OK_CODE);
      assert.deepEqual((await targetCandidate(subject)).dlsite, { state: "none" });
      assert.deepEqual((await setRjCode(subject, OK_CODE)).dlsite, { state: "none" });
      subject.release();
      await waitJobFinished(subject);
      assert.equal((await targetCandidate(subject)).dlsite.state, "fetched");
    } finally {
      await subject.dispose();
    }
  });

  contract(
    "キャッシュヒットした取得（fetch-by-code）と候補一覧は同じタイトルを返す",
    async (subject) => {
      await fetchAndWait(subject, OK_CODE);
      const candidate = await setRjCode(subject, OK_CODE);
      const response = await post(subject, "/api/dlsite/fetch-by-code", { rjCode: OK_CODE });
      const { info } = (await response.json()) as { info: { title: string } };
      assert.equal(candidate.dlsite.state, "fetched");
      if (candidate.dlsite.state === "fetched") assert.equal(candidate.dlsite.title, info.title);
    },
  );

  contract("POST /dlsite/fetch-by-code は取得済みカバーをcachedCoverで返す", async (subject) => {
    const response = await post(subject, "/api/dlsite/fetch-by-code", { rjCode: OK_CODE });
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      info: { rjCode: string };
      cachedCover: { key: string; version: number } | null;
    };
    assert.equal(body.info.rjCode, OK_CODE);
    assert.ok(body.cachedCover);
    const cover = await subject.app.request(
      `/api/media/dlsite-cover/${body.cachedCover.key}?v=${body.cachedCover.version}`,
    );
    assert.equal(cover.status, 200);
  });
}
