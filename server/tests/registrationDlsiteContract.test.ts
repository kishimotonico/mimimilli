// 追加の契約（未登録の候補の追加・Filesの作品登録）を fixture と real の両方へ流す。
// DLsite情報はキャッシュから読み、クライアントのinfoは受け付けない（ADR-0033）。
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  dlsiteInfoTags,
  SCAN_CANDIDATE_REGISTER_MAX_PATHS,
  workspacePath,
  type DlsiteFetchByCodeResponse,
  type DlsiteRegistrationApply,
  type DlsiteWorkInfo,
  type WorkSummary,
} from "@mimimilli/shared";
import type { DataAdapter } from "../src/adapter/index.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import {
  FIXTURE_DLSITE_FETCH_FAILURE_RJ_CODE,
  FIXTURE_DLSITE_NOT_FOUND_RJ_CODE,
  FIXTURE_DLSITE_NO_COVER_RJ_CODE,
} from "../src/adapters/fixture/dlsiteMethods.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG } from "../src/adapters/real/dlsiteConfig.ts";
import {
  coverUrlFromRequest,
  htmlResponse,
  jpegResponse,
  mockDlsiteTransport,
  sampleWorkHtml,
} from "./helpers/dlsiteTransport.ts";
import { buildFixtureAdapterWithCandidates } from "./helpers/fixtureCandidates.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { configureRoot } from "./helpers/rootFolder.ts";
import { makeTestDirectory, SAMPLE_COVER_JPEG_BASE64, writeWav } from "./helpers/sampleLibrary.ts";
import { createApp } from "./helpers/testApp.ts";

const OK_CODE = "RJ000001";
const FOLDER_TITLE = "未登録作品";
const FILES_TITLE = "手入力のタイトル";
const ALL: DlsiteRegistrationApply = { title: true, cover: true, tags: true, url: true };
const SAMPLE_COVER = new Uint8Array(Buffer.from(SAMPLE_COVER_JPEG_BASE64, "base64"));

interface Subject {
  kind: "fixture" | "real";
  app: ReturnType<typeof createApp>;
  /** 候補として一覧に出ているフォルダー */
  candidatePath: string;
  /** Filesの作品登録の対象 */
  filesPath: string;
  noCoverCode: string;
  notFoundCode: string;
  errorCode: string;
  dispose(): Promise<void>;
}

async function createSubject(kind: Subject["kind"]): Promise<Subject> {
  if (kind === "fixture") {
    const adapter: DataAdapter = createFixtureAdapter({ scenario: "new-work" });
    const app = createApp(adapter);
    return {
      kind,
      app,
      candidatePath: FOLDER_TITLE,
      filesPath: "未登録作品",
      noCoverCode: FIXTURE_DLSITE_NO_COVER_RJ_CODE,
      notFoundCode: FIXTURE_DLSITE_NOT_FOUND_RJ_CODE,
      errorCode: FIXTURE_DLSITE_FETCH_FAILURE_RJ_CODE,
      dispose: () => app.shutdown(),
    };
  }
  const directory = makeTestDirectory("registration-dlsite-contract");
  const root = join(directory.path, "library");
  for (const name of [FOLDER_TITLE, "Files作品"]) {
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
        html: (code) => {
          if (code === "RJ000403") return htmlResponse("gone", 404);
          if (code === "RJ000404") return htmlResponse("error", 500);
          if (code === "RJ000402") return htmlResponse(sampleWorkHtml(code, { cover: false }));
          return htmlResponse(sampleWorkHtml(code, { title: `タイトル${code}` }));
        },
        cover: (url) =>
          coverUrlFromRequest(url) ? jpegResponse(SAMPLE_COVER) : htmlResponse("", 404),
      }),
    }),
  );
  const app = createApp(adapter);
  await configureRoot(adapter, root);
  await adapter.scan();
  return {
    kind,
    app,
    candidatePath: FOLDER_TITLE,
    filesPath: "Files作品",
    noCoverCode: "RJ000402",
    notFoundCode: "RJ000403",
    errorCode: "RJ000404",
    dispose: async () => {
      await app.shutdown();
      await directory.cleanup();
    },
  };
}

function post(subject: Subject, path: string, body: unknown) {
  return subject.app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function cacheDlsite(subject: Subject, rjCode: string): Promise<DlsiteWorkInfo | null> {
  const response = await post(subject, "/api/dlsite/fetch-by-code", { rjCode });
  if (response.status !== 200) return null;
  return ((await response.json()) as DlsiteFetchByCodeResponse).info;
}

async function setCandidateRjCode(subject: Subject, rjCode: string) {
  const response = await post(subject, "/api/scan/candidates/rj-code", {
    path: subject.candidatePath,
    rjCode,
  });
  assert.equal(response.status, 200);
}

async function registerCandidate(subject: Subject, apply: DlsiteRegistrationApply, extra = {}) {
  const response = await post(subject, "/api/scan/candidates/register", {
    paths: [subject.candidatePath],
    apply,
    ...extra,
  });
  assert.equal(response.status, 201);
  const { registered, failures } = (await response.json()) as {
    registered: Array<{ workId: string }>;
    failures: unknown[];
  };
  assert.deepEqual(failures, []);
  assert.equal(registered.length, 1);
  return getWork(subject, registered[0]!.workId);
}

async function registerFiles(
  subject: Subject,
  body: { rjCode: string; applyCover: boolean; applyUrl: boolean; tags?: string[] } & Record<
    string,
    unknown
  >,
) {
  const response = await post(subject, "/api/works", {
    path: subject.filesPath,
    title: FILES_TITLE,
    ...body,
  });
  assert.equal(response.status, 201);
  const created = (await response.json()) as { snapshot: { id: string } };
  return getWork(subject, created.snapshot.id);
}

interface RegisteredWork extends WorkSummary {
  coverImage: string | null;
}

async function getWork(subject: Subject, workId: string): Promise<RegisteredWork> {
  const response = await subject.app.request(`/api/works/${workId}`);
  assert.equal(response.status, 200);
  return (await response.json()) as RegisteredWork;
}

const dlsiteUrls = (work: WorkSummary) => work.urls.filter((entry) => entry.label === "DLsite");

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

  contract(
    "取得済みの候補を追加すると、DLsiteのタイトル・タグ・URL・カバーが反映される",
    async (subject) => {
      const info = await cacheDlsite(subject, OK_CODE);
      assert.ok(info);
      await setCandidateRjCode(subject, OK_CODE);
      const work = await registerCandidate(subject, ALL);
      assert.equal(work.title, info.title);
      assert.deepEqual(new Set(work.tags), new Set(dlsiteInfoTags(info)));
      assert.deepEqual(dlsiteUrls(work), [{ label: "DLsite", url: info.url }]);
      assert.ok(work.cover, "カバーが反映される");
      assert.equal(work.dlsite.status, "applied");
      assert.equal(work.dlsite.rjCode, OK_CODE);
      assert.deepEqual(new Set(work.dlsite.appliedTags), new Set(dlsiteInfoTags(info)));
    },
  );

  for (const item of ["title", "cover", "tags", "url"] as const) {
    contract(`候補の追加で${item}をfalseにすると、その項目だけ反映されない`, async (subject) => {
      const info = await cacheDlsite(subject, OK_CODE);
      assert.ok(info);
      await setCandidateRjCode(subject, OK_CODE);
      const work = await registerCandidate(subject, { ...ALL, [item]: false });
      assert.equal(work.title === info.title, item !== "title");
      if (item === "title") assert.equal(work.title, FOLDER_TITLE);
      assert.equal(Boolean(work.cover), item !== "cover");
      assert.equal(work.tags.length > 0, item !== "tags");
      assert.equal(dlsiteUrls(work).length, item === "url" ? 0 : 1);
      assert.equal(work.dlsite.status, "applied");
      if (item === "tags") assert.deepEqual(work.dlsite.appliedTags, []);
    });
  }

  contract("カバーがキャッシュに無い候補は、カバー以外を反映して追加される", async (subject) => {
    const info = await cacheDlsite(subject, subject.noCoverCode);
    assert.ok(info);
    await setCandidateRjCode(subject, subject.noCoverCode);
    const work = await registerCandidate(subject, ALL);
    assert.equal(work.title, info.title);
    assert.equal(work.cover ?? null, null);
    assert.equal(work.dlsite.status, "applied");
    assert.equal(dlsiteUrls(work).length, 1);
  });

  contract(
    "未取得・該当なし・取得失敗・RJコードなしの候補は、フォルダー名のまま追加される",
    async (subject) => {
      await cacheDlsite(subject, subject.notFoundCode);
      await cacheDlsite(subject, subject.errorCode);
      const cases: Array<{ rjCode: string; expected: string | null }> = [
        { rjCode: "RJ000009", expected: "RJ000009" },
        { rjCode: subject.notFoundCode, expected: subject.notFoundCode },
        { rjCode: subject.errorCode, expected: subject.errorCode },
        { rjCode: "", expected: null },
      ];
      for (const { rjCode, expected } of cases) {
        const fresh = await createSubject(subject.kind);
        try {
          await cacheDlsite(fresh, fresh.notFoundCode);
          await cacheDlsite(fresh, fresh.errorCode);
          await setCandidateRjCode(fresh, rjCode);
          const work = await registerCandidate(fresh, ALL);
          assert.equal(work.title, FOLDER_TITLE, rjCode);
          assert.deepEqual(work.tags, [], rjCode);
          assert.equal(work.cover ?? null, null, rjCode);
          assert.equal(dlsiteUrls(work).length, 0, rjCode);
          assert.notEqual(work.dlsite.status, "applied", rjCode);
          assert.deepEqual(work.dlsite.appliedTags, [], rjCode);
          assert.equal(work.dlsite.rjCode, expected, rjCode);
        } finally {
          await fresh.dispose();
        }
      }
    },
  );

  contract(
    "候補の追加は、bodyのinfoやrjCodeを使わず、サーバーが持つ値で決まる",
    async (subject) => {
      const info = await cacheDlsite(subject, OK_CODE);
      assert.ok(info);
      await setCandidateRjCode(subject, OK_CODE);
      const work = await registerCandidate(subject, ALL, {
        rjCode: "RJ999999",
        info: { ...info, title: "偽のタイトル", url: "https://www.dlsite.com/fake.html" },
      });
      assert.equal(work.title, info.title);
      assert.deepEqual(dlsiteUrls(work), [{ label: "DLsite", url: info.url }]);
      assert.equal(work.dlsite.rjCode, OK_CODE);
    },
  );

  contract("候補の追加は paths のないbodyと上限超過を400で拒否する", async (subject) => {
    const withoutPaths = await post(subject, "/api/scan/candidates/register", {
      items: [{ path: subject.candidatePath }],
    });
    assert.equal(withoutPaths.status, 400);
    const tooMany = await post(subject, "/api/scan/candidates/register", {
      paths: Array.from({ length: SCAN_CANDIDATE_REGISTER_MAX_PATHS + 1 }, (_, i) => `候補${i}`),
      apply: ALL,
    });
    assert.equal(tooMany.status, 400);
  });

  contract(
    "Filesの作品登録は、キャッシュからカバーとURLを読み、appliedTagsを入力タグとの共通部分にする",
    async (subject) => {
      const info = await cacheDlsite(subject, OK_CODE);
      assert.ok(info);
      const dlsiteTags = dlsiteInfoTags(info);
      const picked = dlsiteTags.slice(0, 1);
      const work = await registerFiles(subject, {
        rjCode: OK_CODE,
        applyCover: true,
        applyUrl: true,
        tags: [...picked, "手入力"],
      });
      assert.equal(work.title, FILES_TITLE);
      assert.deepEqual(new Set(work.tags), new Set([...picked, "手入力"]));
      assert.deepEqual(dlsiteUrls(work), [{ label: "DLsite", url: info.url }]);
      assert.ok(work.cover);
      assert.equal(work.dlsite.status, "applied");
      assert.deepEqual(work.dlsite.appliedTags, picked);
    },
  );

  contract(
    "Filesの作品登録は、キャッシュに無いコード・RJコードなしでは入力どおりでnone",
    async (subject) => {
      const unknown = await registerFiles(subject, {
        rjCode: "RJ000009",
        applyCover: true,
        applyUrl: true,
      });
      assert.equal(unknown.title, FILES_TITLE);
      assert.equal(unknown.cover ?? null, null);
      assert.equal(dlsiteUrls(unknown).length, 0);
      assert.equal(unknown.dlsite.status, "none");
      assert.equal(unknown.dlsite.rjCode, "RJ000009");

      const fresh = await createSubject(subject.kind);
      try {
        const none = await registerFiles(fresh, { rjCode: "", applyCover: true, applyUrl: true });
        assert.equal(none.dlsite.rjCode, null);
        assert.equal(none.dlsite.status, "none");
      } finally {
        await fresh.dispose();
      }
    },
  );

  contract(
    "Filesの作品登録は、カバーがキャッシュに無ければカバーだけ反映せず成功する",
    async (subject) => {
      const info = await cacheDlsite(subject, subject.noCoverCode);
      assert.ok(info);
      const work = await registerFiles(subject, {
        rjCode: subject.noCoverCode,
        applyCover: true,
        applyUrl: true,
      });
      assert.equal(work.cover ?? null, null);
      assert.deepEqual(dlsiteUrls(work), [{ label: "DLsite", url: info.url }]);
    },
  );

  contract("Filesの作品登録は、bodyのinfoを使わない", async (subject) => {
    const info = await cacheDlsite(subject, OK_CODE);
    assert.ok(info);
    const work = await registerFiles(subject, {
      rjCode: OK_CODE,
      applyCover: false,
      applyUrl: true,
      info: { ...info, url: "https://www.dlsite.com/fake.html", title: "偽のタイトル" },
    });
    assert.deepEqual(dlsiteUrls(work), [{ label: "DLsite", url: info.url }]);
    assert.equal(work.title, FILES_TITLE);
  });
}

test("fixtureの候補1000件を、上限ごとの分割で全件追加できる", async () => {
  const paths = Array.from({ length: 1000 }, (_, index) => `候補${index}`);
  const app = createApp(
    buildFixtureAdapterWithCandidates(
      paths.map((path) => ({
        path: workspacePath(path),
        inferredTitle: path,
        audioFileCount: 1,
        audioBreakdown: [{ extension: "wav", count: 1 }],
        detectedRjCode: null,
      })),
    ),
  );
  try {
    for (let start = 0; start < paths.length; start += SCAN_CANDIDATE_REGISTER_MAX_PATHS) {
      const response = await app.request("/api/scan/candidates/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paths: paths.slice(start, start + SCAN_CANDIDATE_REGISTER_MAX_PATHS),
          apply: ALL,
        }),
      });
      assert.equal(response.status, 201);
    }
    const listed = (await (await app.request("/api/scan/candidates")).json()) as {
      candidates: unknown[];
    };
    assert.equal(listed.candidates.length, 0);
    assert.equal((await (await app.request("/api/works?limit=1")).json()).total, 1000);
  } finally {
    await app.shutdown();
  }
});
