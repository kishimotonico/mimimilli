import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SCAN_CANDIDATE_REGISTER_MAX_PATHS,
  scanCandidateRjCodeRequestSchema,
  scanCandidateSchema,
  workspacePath,
} from "@mimimilli/shared";
import type { DataAdapter } from "../src/adapter/index.ts";
import { buildFixtureAdapterWithCandidates } from "./helpers/fixtureCandidates.ts";
import { runScan } from "./helpers/scanLibrary.ts";
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
  assert.equal(typeof target?.dlsiteRevision, "number");
  assert.deepEqual(target, {
    path: TARGET,
    inferredTitle: "未登録作品",
    audioFileCount: 2,
    audioBreakdown: [{ extension: "mp3", count: 2 }],
    rjCode: null,
    rjCodeEdited: false,
    dlsite: { state: "none" },
    dlsiteRevision: target!.dlsiteRevision,
    missingWorks: [],
  });
});

contract(
  "候補フローの外で登録したパスは、候補一覧にも再スキャン後の候補にも出ない",
  async (harness) => {
    assert.equal(hasTarget(await listCandidates(harness)), true);
    const created = await harness.send("POST", "/api/works", {
      path: "未登録作品",
      title: "候補の外で登録",
      rjCode: "",
      applyCover: false,
      applyUrl: false,
    });
    assert.equal(created.status, 201);
    assert.equal(hasTarget(await listCandidates(harness)), false);

    assert.equal((await harness.send("POST", "/api/scan")).status, 202);
    await pollUntil(async () => (await harness.json("/api/scan")).body.status !== "running");
    assert.equal(hasTarget(await listCandidates(harness)), false);
  },
);

contract("候補を登録すると作品一覧に加わり、候補一覧から消える", async (harness) => {
  const registered = await harness.send("POST", "/api/scan/candidates/register", {
    paths: ["未登録作品"],
    apply: { title: true, cover: true, tags: true, url: true },
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

contract("候補から追加した作品を登録解除すると、再スキャンなしで候補に戻る", async (harness) => {
  const registered = await harness.send("POST", "/api/scan/candidates/register", {
    paths: ["未登録作品"],
    apply: { title: true, cover: true, tags: true, url: true },
  });
  assert.equal(registered.status, 201);
  assert.equal(hasTarget(await listCandidates(harness)), false);

  const removed = await harness.send(
    "DELETE",
    `/api/works/${registered.body.registered[0].workId}`,
  );
  assert.equal(removed.status, 204);
  assert.equal(hasTarget(await listCandidates(harness)), true);
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
    assert.equal(listed?.rjCodeEdited, true);

    const registered = await harness.send("POST", "/api/scan/candidates/register", {
      paths: ["未登録作品"],
      apply: { title: true, cover: true, tags: true, url: true },
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

contract("次のスキャンでも、候補に残っているフォルダーの直したRJコードは残る", async (harness) => {
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
  assert.equal(listed?.rjCode, "RJ1234567");
  assert.equal(listed?.rjCodeEdited, true);
});

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
    assert.equal(fixed.body.candidate.rjCodeEdited, true);
    const registered = await harness.send("POST", "/api/scan/candidates/register", {
      paths: ["RJ123456_推定あり", "RJ234567_空指定"],
      apply: { title: true, cover: true, tags: true, url: true },
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
    paths: ["RJ123456_推定あり", "古い候補"],
    apply: { title: true, cover: true, tags: true, url: true },
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

type RegisterFolder = DataAdapter["registerCandidateFolder"];

const APPLY_ALL = { title: true, cover: true, tags: true, url: true };

/** 指定パスを候補プールに持つfixtureで、登録の素材だけを差し替えたアプリ。ルートの写像を確認する */
async function appWithRegister(paths: string[], registerCandidateFolder: RegisterFolder) {
  const adapter: DataAdapter = {
    ...(await buildFixtureAdapterWithCandidates(
      paths.map((path) => ({
        path: workspacePath(path),
        inferredTitle: path,
        audioFileCount: 1,
        audioBreakdown: [{ extension: "mp3", count: 1 }],
        detectedRjCode: null,
      })),
    )),
    registerCandidateFolder,
  };
  await runScan(adapter);
  return createApp(adapter);
}

const postRegister = (app: ReturnType<typeof createApp>, paths: string[], apply = APPLY_ALL) =>
  app.request("/api/scan/candidates/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths, apply }),
  });

test("候補登録はDLsite取得ジョブを作らない", async () => {
  const app = await appWithRegister(["候補作品"], async () => ({
    workId: "work-a",
    coverSkipped: null,
  }));
  try {
    const registered = await postRegister(app, ["候補作品"]);
    assert.equal(registered.status, 201);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal((await (await app.request("/api/dlsite/jobs/current")).json()).job, null);
  } finally {
    await app.shutdown();
  }
});

test("候補登録APIは部分失敗と全失敗を201で返す", async () => {
  const app = await appWithRegister(["候補作品", "失敗作品"], async (folder) => {
    if (folder.path === "失敗作品") throw new Error("catalogの投影に失敗しました");
    return { workId: "work-ok", coverSkipped: null };
  });
  try {
    const partial = await postRegister(app, ["候補作品", "失敗作品"]);
    assert.equal(partial.status, 201);
    assert.deepEqual(await partial.json(), {
      registered: [{ path: "候補作品", workId: "work-ok", coverSkipped: null }],
      failures: [{ path: "失敗作品", message: "catalogの投影に失敗しました" }],
    });
  } finally {
    await app.shutdown();
  }
});

test("候補登録APIは全失敗を成功なしの結果として201で返す", async () => {
  const app = await appWithRegister(["候補作品"], async () => {
    throw new Error("mimimilli.jsonの生成に失敗しました");
  });
  try {
    const failed = await postRegister(app, ["候補作品"]);
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

test("候補APIは上限ちょうどの件数を受け付け、超えると400にする", async () => {
  const pathsOf = (count: number) => Array.from({ length: count }, (_, index) => `候補-${index}`);
  const atLimit = pathsOf(SCAN_CANDIDATE_REGISTER_MAX_PATHS);
  const apply = { title: true, cover: false, tags: true, url: false };
  const received: Array<{ path: string; apply: unknown }> = [];
  const app = await appWithRegister(atLimit, async (folder, _rjCode, applied) => {
    received.push({ path: folder.path, apply: applied });
    return { workId: `work-${folder.path}`, coverSkipped: null };
  });
  try {
    const accepted = await postRegister(app, atLimit, apply);
    assert.equal(accepted.status, 201);
    assert.deepEqual(
      received,
      atLimit.map((path) => ({ path, apply })),
    );
    received.length = 0;
    const overLimit = await postRegister(
      app,
      pathsOf(SCAN_CANDIDATE_REGISTER_MAX_PATHS + 1),
      apply,
    );
    assert.equal(overLimit.status, 400);
    assert.deepEqual(received, []);
  } finally {
    await app.shutdown();
  }
});
