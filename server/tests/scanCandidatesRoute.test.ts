import assert from "node:assert/strict";
import { test } from "node:test";
import {
  scanCandidateRjCodeRequestSchema,
  scanCandidateSchema,
  scanCandidatesRegisterResponseSchema,
  workspacePath,
} from "@mimimilli/shared";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createApp } from "./helpers/testApp.ts";
import { pollUntil } from "./helpers/poll.ts";
import { defineContract, type ContractHarness } from "./helpers/contractHarness.ts";

// fixture はシナリオ new-work の候補を持つ（未登録作品のほか、fixture 固有の入れ子候補「朗読/候補」）。
// 入れ子候補は real の候補探索（作品ルートは最上位フォルダー）と一致しないため、両 adapter に共通する
// 「未登録作品」だけを検証対象にする
const contract = defineContract({
  works: [{ key: "existing", title: "登録済み作品" }],
  candidateFolders: [{ path: "未登録作品", audioFiles: ["a.mp3", "b.mp3"] }],
  fixture: { scenario: "new-work" },
});

const TARGET = workspacePath("未登録作品");

async function listCandidates(harness: ContractHarness) {
  const { status, body } = await harness.json("/api/scan/candidates");
  assert.equal(status, 200);
  return (body.candidates as unknown[]).map((entry) => scanCandidateSchema.parse(entry));
}

const hasTarget = (candidates: Array<{ path: string }>) =>
  candidates.some((entry) => entry.path === TARGET);

contract("候補一覧は未登録フォルダーの推定タイトルと音声内訳を返す", async (harness) => {
  const target = (await listCandidates(harness)).find((entry) => entry.path === TARGET);
  assert.deepEqual(target, {
    path: TARGET,
    inferredTitle: "未登録作品",
    audioFileCount: 2,
    audioBreakdown: [{ extension: "mp3", count: 2 }],
    rjCode: null,
    dlsite: { state: "none" },
    missingWorks: [],
  });
});

contract("候補を登録すると作品一覧に加わり、候補一覧から消える", async (harness) => {
  const registered = await harness.send("POST", "/api/scan/candidates/register", {
    items: [{ path: "未登録作品" }],
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.registered.length, 1);
  assert.equal(registered.body.registered[0].path, "未登録作品");
  assert.deepEqual(registered.body.failures, []);
  const workId: string = registered.body.registered[0].workId;

  const work = await harness.json(`/api/works/${workId}`);
  assert.equal(work.status, 200);
  assert.equal(work.body.title, "未登録作品");
  assert.equal(hasTarget(await listCandidates(harness)), false);
});

contract("候補の除外は一覧から隠し、除外解除で戻る", async (harness) => {
  const excluded = await harness.send("POST", "/api/scan/candidates/exclude", {
    paths: ["未登録作品"],
  });
  assert.equal(excluded.status, 204);
  assert.equal(hasTarget(await listCandidates(harness)), false);
  assert.deepEqual((await harness.json("/api/scan/candidates/exclusions")).body, {
    paths: ["未登録作品"],
  });

  const restored = await harness.send("POST", "/api/scan/candidates/exclusions/restore", {
    paths: ["未登録作品"],
  });
  assert.equal(restored.status, 204);
  assert.equal(hasTarget(await listCandidates(harness)), true);
});

contract(
  "候補のRJコードを直すと正規化して一覧に保持され、登録はその値で行われる",
  async (harness) => {
    const fixed = await harness.send("POST", "/api/scan/candidates/rj-code", {
      path: "未登録作品",
      rjCode: "rj1234567",
    });
    assert.equal(fixed.status, 200);
    assert.equal(scanCandidateSchema.parse(fixed.body.candidate).rjCode, "RJ1234567");
    const listed = (await listCandidates(harness)).find((entry) => entry.path === TARGET);
    assert.equal(listed?.rjCode, "RJ1234567");

    const registered = await harness.send("POST", "/api/scan/candidates/register", {
      items: [{ path: "未登録作品" }],
    });
    assert.equal(registered.status, 201);
    const work = await harness.json(`/api/works/${registered.body.registered[0].workId}`);
    assert.equal(work.body.dlsite.rjCode, "RJ1234567");
  },
);

contract("RJコード修正は不正な形式を400で拒否し、一覧の値を変えない", async (harness) => {
  const response = await harness.send("POST", "/api/scan/candidates/rj-code", {
    path: "未登録作品",
    rjCode: "RJ123",
  });
  assert.equal(response.status, 400);
  const listed = (await listCandidates(harness)).find((entry) => entry.path === TARGET);
  assert.equal(listed?.rjCode, null);
});

contract("除外してから戻しても、直したRJコードは残る", async (harness) => {
  await harness.send("POST", "/api/scan/candidates/rj-code", {
    path: "未登録作品",
    rjCode: "RJ1234567",
  });
  await harness.send("POST", "/api/scan/candidates/exclude", { paths: ["未登録作品"] });
  const excludedFix = await harness.send("POST", "/api/scan/candidates/rj-code", {
    path: "未登録作品",
    rjCode: "RJ7654321",
  });
  assert.equal(excludedFix.status, 409);
  await harness.send("POST", "/api/scan/candidates/exclusions/restore", {
    paths: ["未登録作品"],
  });
  const listed = (await listCandidates(harness)).find((entry) => entry.path === TARGET);
  assert.equal(listed?.rjCode, "RJ1234567");
});

contract(
  "次のスキャンで、直したRJコードは破棄されフォルダー名から検出し直される",
  async (harness) => {
    await harness.send("POST", "/api/scan/candidates/rj-code", {
      path: "未登録作品",
      rjCode: "RJ1234567",
    });
    const started = await harness.send("POST", "/api/scan");
    assert.equal(started.status, 202);
    await pollUntil(async () => {
      const job = await harness.json(`/api/scan/${started.body.job.id}`);
      return job.body.status === "completed";
    });
    const listed = (await listCandidates(harness)).find((entry) => entry.path === TARGET);
    assert.equal(listed?.rjCode, null);
  },
);

contract("RJコード修正は候補にないパスを409で拒否する", async (harness) => {
  const response = await harness.send("POST", "/api/scan/candidates/rj-code", {
    path: "存在しない候補",
    rjCode: "RJ1234567",
  });
  assert.equal(response.status, 409);
});

// real のみ: フォルダー名由来のRJコードと、省略・空文字の区別は実ファイルの推定に依存する
const realContract = defineContract(
  {
    works: [],
    candidateFolders: [
      { path: "RJ123456_推定あり", audioFiles: ["a.wav"] },
      { path: "RJ234567_空指定", audioFiles: ["a.wav"] },
    ],
  },
  { kinds: ["real"] },
);

realContract(
  "候補登録のRJコードは、直さなければフォルダー名からの推定値、なしに直せば明示的なしとして保持される",
  async (harness) => {
    const fixed = await harness.send("POST", "/api/scan/candidates/rj-code", {
      path: "RJ234567_空指定",
      rjCode: "",
    });
    assert.equal(fixed.status, 200);
    assert.equal(fixed.body.candidate.rjCode, null);
    const registered = await harness.send("POST", "/api/scan/candidates/register", {
      items: [{ path: "RJ123456_推定あり" }, { path: "RJ234567_空指定" }],
    });
    assert.equal(registered.status, 201);
    const rjCodes = new Map<string, string | null>();
    for (const entry of registered.body.registered) {
      rjCodes.set(
        entry.path,
        (await harness.json(`/api/works/${entry.workId}`)).body.dlsite.rjCode,
      );
    }
    assert.equal(rjCodes.get("RJ123456_推定あり"), "RJ123456");
    assert.equal(rjCodes.get("RJ234567_空指定"), "");
  },
);

realContract("候補にないパスを含む登録・除外は409で拒否し、何も書き込まない", async (harness) => {
  const stale = await harness.send("POST", "/api/scan/candidates/register", {
    items: [{ path: "RJ123456_推定あり" }, { path: "古い候補" }],
  });
  assert.equal(stale.status, 409);
  assert.equal((await harness.json("/api/works")).body.total, 0);

  const staleExclude = await harness.send("POST", "/api/scan/candidates/exclude", {
    paths: ["古い候補"],
  });
  assert.equal(staleExclude.status, 409);
});

// 以降は adapter メソッドを差し替えて、ルートの写像（DLsite取得を積まないこと・部分失敗の201・
// リクエスト→adapter 引数）を fixture ベースで確認する。adapter の戻り値は両 adapter で
// 一様には作れないため、上の contract では扱わない

test("候補登録はDLsite取得ジョブを作らない", async () => {
  const app = createApp({
    ...createFixtureAdapter(),
    registerScanCandidates: async () =>
      scanCandidatesRegisterResponseSchema.parse({
        registered: [
          { path: "候補作品", workId: "work-a" },
          { path: "候補作品-2", workId: "work-b" },
        ],
        failures: [],
      }),
  });

  try {
    const registered = await app.request("/api/scan/candidates/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ path: "候補作品" }] }),
    });
    assert.equal(registered.status, 201);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(await (await app.request("/api/dlsite/jobs/current")).json(), { job: null });
  } finally {
    await app.shutdown();
  }
});

test("候補登録APIは部分失敗と全失敗を201で返す", async () => {
  const fixture = createFixtureAdapter();
  const app = createApp({
    ...fixture,
    registerScanCandidates: async () =>
      scanCandidatesRegisterResponseSchema.parse({
        registered: [{ path: "候補作品", workId: "work-ok" }],
        failures: [{ path: "失敗作品", message: "catalogの投影に失敗しました" }],
      }),
  });
  try {
    const partial = await app.request("/api/scan/candidates/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ path: "候補作品" }] }),
    });
    assert.equal(partial.status, 201);
    assert.deepEqual(await partial.json(), {
      registered: [{ path: "候補作品", workId: "work-ok" }],
      failures: [{ path: "失敗作品", message: "catalogの投影に失敗しました" }],
    });
  } finally {
    await app.shutdown();
  }
});

test("候補登録APIは全失敗を成功なしの結果として201で返す", async () => {
  const fixture = createFixtureAdapter();
  const app = createApp({
    ...fixture,
    registerScanCandidates: async () =>
      scanCandidatesRegisterResponseSchema.parse({
        registered: [],
        failures: [{ path: "候補作品", message: "mimimilli.jsonの生成に失敗しました" }],
      }),
  });
  try {
    const failed = await app.request("/api/scan/candidates/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ path: "候補作品" }] }),
    });
    assert.equal(failed.status, 201);
    assert.deepEqual(await failed.json(), {
      registered: [],
      failures: [{ path: "候補作品", message: "mimimilli.jsonの生成に失敗しました" }],
    });
  } finally {
    await app.shutdown();
  }
});

test("scanCandidateRjCodeRequestSchema: RJ/VJコードの形式を検証・正規化し、空文字はそのまま通す", () => {
  const lowercase = scanCandidateRjCodeRequestSchema.safeParse({
    path: "候補作品",
    rjCode: "rj1234567",
  });
  assert.equal(lowercase.success, true);
  if (lowercase.success) assert.equal(lowercase.data.rjCode, "RJ1234567");

  const empty = scanCandidateRjCodeRequestSchema.safeParse({ path: "候補作品", rjCode: "" });
  assert.equal(empty.success, true);
  if (empty.success) assert.equal(empty.data.rjCode, "");

  assert.equal(scanCandidateRjCodeRequestSchema.safeParse({ path: "候補作品" }).success, false);

  const tooShort = scanCandidateRjCodeRequestSchema.safeParse({
    path: "候補作品",
    rjCode: "RJ123",
  });
  assert.equal(tooShort.success, false);
});

test("候補APIは101件以上の一括登録を受け付ける", async () => {
  const paths = Array.from({ length: 101 }, (_, index) => `候補-${index}`);
  const fixture = createFixtureAdapter();
  let received: Array<{ path: string }> = [];
  const app = createApp({
    ...fixture,
    registerScanCandidates: async (requestedItems) => {
      received = requestedItems;
      return { registered: [], failures: [] };
    },
  });
  try {
    const response = await app.request("/api/scan/candidates/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: paths.map((path) => ({ path })) }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(
      received,
      paths.map((path) => ({ path })),
    );
  } finally {
    await app.shutdown();
  }
});
