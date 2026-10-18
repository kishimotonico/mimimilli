// HTTP route の基本疎通・バリデーション・エラー写像。データに依存するケースは fixture / real の両方で、
// adapter の戻り値だけに依存するケース（取得分類→HTTPコード、ジョブ状態、fixture専用APIなど）は
// fixture ベースで adapter メソッドを差し替えて検証する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareJapaneseSortKeys } from "../src/core/japaneseSortKey.ts";
import { createApp } from "./helpers/testApp.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { defineContract, type ContractHarness } from "./helpers/contractHarness.ts";

const YEAR = new Date().getFullYear();

const contract = defineContract({
  works: [
    { key: "a", title: "あ作品", tags: ["ASMR", "cv/声優A", "tag,one"] },
    { key: "b", title: "い作品", tags: ["ASMR", "cv/声優A", "tag2"] },
    { key: "c", title: "う作品", tags: ["cv/声優B"] },
  ],
});

const ALL_IDS = ["a", "b", "c"].map((key) => ({ key }));

function idsOf(harness: ContractHarness, keys: string[]): string[] {
  return keys.map((key) => harness.workId(key)).sort();
}

function sortedIds(items: Array<{ id: string }>): string[] {
  return items.map((item) => item.id).sort();
}

async function sourceRevisionOf(harness: ContractHarness, id: string): Promise<string> {
  const { status, body } = await harness.json(`/api/works/${id}/source`);
  assert.equal(status, 200);
  assert.equal(typeof body.sourceRevision, "string");
  return body.sourceRevision;
}

contract("GET /api/works は登録済みの全作品を {items, total} で返す", async (harness) => {
  const { status, body } = await harness.json("/api/works");
  assert.equal(status, 200);
  assert.equal(body.total, ALL_IDS.length);
  assert.deepEqual(sortedIds(body.items), idsOf(harness, ["a", "b", "c"]));
});

contract("GET /api/works は複数の tags を配列で受け、タグ内のカンマを保持する", async (harness) => {
  const matched = await harness.json("/api/works?tags=tag%2Cone&tags=ASMR");
  assert.equal(matched.status, 200);
  assert.deepEqual(sortedIds(matched.body.items), idsOf(harness, ["a"]));

  const split = await harness.json("/api/works?tags=tag&tags=one");
  assert.equal(split.status, 200);
  assert.equal(split.body.total, 0);
});

contract(
  "GET /api/works は擬似タグとして解釈できない @ 始まりのtagsを400で拒否する",
  async (harness) => {
    for (const badTag of ["@year", "@year/", "@/2024", "@year/banana", "@unknown/2024"]) {
      const { status, body } = await harness.json(`/api/works?tags=${encodeURIComponent(badTag)}`);
      assert.equal(status, 400, badTag);
      assert.equal(body.error.code, "invalid_request", badTag);
    }
  },
);

contract("GET /api/works は正しい @year/YYYY 擬似タグで追加年に絞り込む", async (harness) => {
  const thisYear = await harness.json(`/api/works?tags=${encodeURIComponent(`@year/${YEAR}`)}`);
  assert.equal(thisYear.status, 200);
  assert.equal(thisYear.body.total, ALL_IDS.length);

  const otherYear = await harness.json(`/api/works?tags=${encodeURIComponent("@year/1999")}`);
  assert.equal(otherYear.status, 200);
  assert.equal(otherYear.body.total, 0);
});

contract(
  "GET /api/works は先頭に空白を挟んだ擬似タグも正規化後の値で判定し受理する",
  async (harness) => {
    const { status, body } = await harness.json(
      `/api/works?tags=${encodeURIComponent(` @year/${YEAR}`)}`,
    );
    assert.equal(status, 200);
    assert.equal(body.total, ALL_IDS.length);
  },
);

contract("GET /api/works は ids を複数指定すると該当作品のみへ絞り込む", async (harness) => {
  const { status, body } = await harness.json(
    `/api/works?ids=${harness.workId("a")}&ids=${harness.workId("c")}`,
  );
  assert.equal(status, 200);
  assert.deepEqual(sortedIds(body.items), idsOf(harness, ["a", "c"]));
  assert.equal(body.total, 2);
});

contract("GET /api/works は ids に他のフィルタ・ページングを組み合わせられる", async (harness) => {
  const ids = ["a", "b", "c"].map((key) => `ids=${harness.workId(key)}`).join("&");
  const { status, body } = await harness.json(`/api/works?${ids}&limit=1&page=1&sort=id-asc`);
  assert.equal(status, 200);
  assert.deepEqual(
    body.items.map((item: { id: string }) => item.id),
    [idsOf(harness, ["a", "b", "c"])[0]],
  );
  assert.equal(body.total, 3);
});

contract("GET /api/works/:id 存在しないIDは404 + apiErrorSchema形式", async (harness) => {
  const { status, body } = await harness.json("/api/works/NOT_EXIST");
  assert.equal(status, 404);
  assert.equal(body.error.code, "not_found");
  assert.equal(typeof body.error.message, "string");
});

contract("PATCH /api/works/:id でタグ更新が反映される", async (harness) => {
  const id = harness.workId("a");
  const sourceRevision = await sourceRevisionOf(harness, id);
  const patched = await harness.send("PATCH", `/api/works/${id}`, {
    tags: ["テスト用タグ"],
    sourceRevision,
  });
  assert.equal(patched.status, 200);
  assert.deepEqual(patched.body.snapshot.tags, ["テスト用タグ"]);

  const fetched = await harness.json(`/api/works/${id}`);
  assert.deepEqual(fetched.body.tags, ["テスト用タグ"]);
});

contract("PATCH /api/works/:id でurls更新が反映される", async (harness) => {
  const id = harness.workId("a");
  const urls = [{ label: "公式", url: "https://example.com/work" }];
  const patched = await harness.send("PATCH", `/api/works/${id}`, {
    urls,
    sourceRevision: await sourceRevisionOf(harness, id),
  });
  assert.equal(patched.status, 200);
  assert.deepEqual(patched.body.snapshot.urls, urls);
  assert.deepEqual((await harness.json(`/api/works/${id}`)).body.urls, urls);
});

contract("PATCH /api/works/:id は危険スキームのurlsを400で拒否する", async (harness) => {
  const id = harness.workId("a");
  const { status } = await harness.send("PATCH", `/api/works/${id}`, {
    urls: [{ label: "evil", url: "javascript:alert(1)" }],
    sourceRevision: await sourceRevisionOf(harness, id),
  });
  assert.equal(status, 400);
});

contract("GET /api/works/:id の JSON に sourceRevision は無く、/source が返す", async (harness) => {
  const id = harness.workId("a");
  const detail = await harness.json(`/api/works/${id}`);
  assert.equal("sourceRevision" in detail.body, false);
  assert.ok((await sourceRevisionOf(harness, id)).length > 0);
});

contract("PATCH /api/works/:id/bookmark は sourceRevision なしで通る", async (harness) => {
  const id = harness.workId("a");
  const res = await harness.send("PATCH", `/api/works/${id}/bookmark`, {
    bookmarked: true,
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { bookmarked: true });
  assert.equal((await harness.json(`/api/works/${id}`)).body.bookmarked, true);
});

contract("PUT/DELETE /api/works/:id/tags/:tag はパスのタグを正規化する", async (harness) => {
  const id = harness.workId("a");
  const slashTag = encodeURIComponent("CV/ foo ");
  const put = await harness.send("PUT", `/api/works/${id}/tags/${slashTag}`);
  assert.equal(put.status, 200);
  assert.ok(put.body.snapshot.tags.includes("cv/foo"));
  const del = await harness.send("DELETE", `/api/works/${id}/tags/${slashTag}`);
  assert.equal(del.status, 200);
  assert.equal(del.body.snapshot.tags.includes("cv/foo"), false);
});

contract("PATCH /api/works/:id はsourceRevisionなしを400で拒否する", async (harness) => {
  const { status, body } = await harness.send("PATCH", `/api/works/${harness.workId("a")}`, {
    title: "更新",
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, "invalid_request");
});

contract("PATCH /api/works/:id は古いsourceRevisionを409 source_changedで返す", async (harness) => {
  const { status, body } = await harness.send("PATCH", `/api/works/${harness.workId("a")}`, {
    title: "更新",
    sourceRevision: "stale",
  });
  assert.equal(status, 409);
  assert.equal(body.error.code, "source_changed");
});

contract("GET /api/axes/cv は AxisFacetItem[] を count 降順で返す", async (harness) => {
  const { status, body } = await harness.json("/api/axes/cv");
  assert.equal(status, 200);
  assert.deepEqual(
    body.map((item: { value: string; count: number }) => [item.value, item.count]),
    [
      ["声優A", 2],
      ["声優B", 1],
    ],
  );
});

contract(
  "GET /api/axes/:axis は未登録 prefix でも集計する（該当なしは空配列）",
  async (harness) => {
    const { status, body } = await harness.json("/api/axes/unknown-prefix");
    assert.equal(status, 200);
    assert.deepEqual(body, []);
  },
);

contract("GET /api/axes/:axis にスラッシュ入りの軸を渡すと400", async (harness) => {
  const { status, body } = await harness.json(`/api/axes/${encodeURIComponent("a/b")}`);
  assert.equal(status, 400);
  assert.equal(body.error.code, "invalid_request");
});

contract("GET /api/axes/:axis は tags/tagOp で作品を絞り込んで集計する", async (harness) => {
  const and = await harness.json("/api/axes/cv?tags=ASMR");
  assert.deepEqual(
    and.body.map((item: { value: string; count: number }) => [item.value, item.count]),
    [["声優A", 2]],
  );

  const or = await harness.json("/api/axes/cv?tags=tag2&tags=cv%2F%E5%A3%B0%E5%84%AAB&tagOp=OR");
  assert.deepEqual(or.body.map((item: { value: string; count: number }) => item.value).sort(), [
    "声優A",
    "声優B",
  ]);
});

contract("GET /api/axes/:axis は tagOp 省略時 AND で絞り込む", async (harness) => {
  const query = "tags=ASMR&tags=cv%2F%E5%A3%B0%E5%84%AAB";
  const and = await harness.json(`/api/axes/cv?${query}`);
  assert.deepEqual(and.body, []);

  const or = await harness.json(`/api/axes/cv?${query}&tagOp=OR`);
  assert.deepEqual(
    or.body.map((item: { value: string; count: number }) => [item.value, item.count]).sort(),
    [
      ["声優A", 2],
      ["声優B", 1],
    ],
  );
});

contract("GET /api/axes/:axis は組み込み軸の擬似タグも絞り込みに含める", async (harness) => {
  const thisYear = await harness.json(
    `/api/axes/cv?tags=${encodeURIComponent(`@year/${YEAR}`)}&tags=ASMR`,
  );
  assert.equal(thisYear.status, 200);
  assert.deepEqual(
    thisYear.body.map((item: { value: string; count: number }) => [item.value, item.count]),
    [["声優A", 2]],
  );
  const otherYear = await harness.json(`/api/axes/cv?tags=${encodeURIComponent("@year/1999")}`);
  assert.deepEqual(otherYear.body, []);
});

contract(
  "GET /api/axes/:axis は擬似タグとして解釈できない @ 始まりのtagsを400で拒否する",
  async (harness) => {
    const { status, body } = await harness.json("/api/axes/cv?tags=%40year%2Fbanana");
    assert.equal(status, 400);
    assert.equal(body.error.code, "invalid_request");
  },
);

contract(
  "GET /api/smart-folders/:id/works は擬似タグとして解釈できない @ 始まりのtagsを400で拒否する",
  async (harness) => {
    const created = await harness.send("POST", "/api/smart-folders", {
      name: "テスト",
      rules: [],
      sort: "added-desc",
    });
    const { status, body } = await harness.json(
      `/api/smart-folders/${created.body.id}/works?tags=%40year%2F`,
    );
    assert.equal(status, 400);
    assert.equal(body.error.code, "invalid_request");
  },
);

contract("GET /api/fs はルートの listing を返す", async (harness) => {
  const { status, body } = await harness.json("/api/fs");
  assert.equal(status, 200);
  assert.equal(body.path, null);
  assert.ok(Array.isArray(body.entries));
});

contract("POST /api/smart-folders は201 + 作成されたSmartFolderを返す", async (harness) => {
  const { status, body } = await harness.send("POST", "/api/smart-folders", {
    name: "テストフォルダー",
    rules: [],
    sort: "added-desc",
  });
  assert.equal(status, 201);
  assert.equal(body.name, "テストフォルダー");
  assert.equal(typeof body.id, "string");
  assert.equal(typeof body.createdAt, "string");
});

contract("POST /api/smart-folders は未対応ルールを400で拒否する", async (harness) => {
  const { status, body } = await harness.send("POST", "/api/smart-folders", {
    name: "不正ルール",
    rules: [{ conjunction: "WHERE", field: "不明", operator: "=", values: ["x"] }],
    sort: "added-desc",
  });
  assert.equal(status, 400);
  assert.equal(body.error.code, "invalid_request");
});

contract("スマートフォルダーの作品一覧は保存済み sort を適用する", async (harness) => {
  const created = await harness.send("POST", "/api/smart-folders", {
    name: "タイトル降順",
    rules: [],
    sort: "title-desc",
  });
  const { status, body } = await harness.json(`/api/smart-folders/${created.body.id}/works`);
  assert.equal(status, 200);
  assert.equal(body.total, ALL_IDS.length);
  const titles = body.items.map((work: { title: string }) => work.title);
  assert.deepEqual(
    titles,
    [...titles].sort((a, b) => compareJapaneseSortKeys(b, a)),
  );
});

contract("randomソートのスマートフォルダーも作品一覧を返す", async (harness) => {
  const created = await harness.send("POST", "/api/smart-folders", {
    name: "ランダム",
    rules: [],
    sort: "random",
  });
  const { status, body } = await harness.json(`/api/smart-folders/${created.body.id}/works`);
  assert.equal(status, 200);
  assert.equal(body.items.length, ALL_IDS.length);
  assert.equal(typeof body.seed, "number");
});

contract("未知ルートは404 + not_found", async (harness) => {
  const { status, body } = await harness.json("/api/unknown-route");
  assert.equal(status, 404);
  assert.equal(body.error.code, "not_found");
});

// 以降は adapter メソッドの差し替えと fixture 専用 API に依存するケース（fixture のみ）

test("POST /api/dlsite/:id/fetch は取得分類をHTTPエラーコードへ反映する", async () => {
  for (const [kind, status] of [
    ["not_found", 404],
    ["parse_error", 502],
    ["error", 502],
  ] as const) {
    const adapter = createFixtureAdapter();
    adapter.dlsiteFetch = async () => ({ ok: false, kind, message: `${kind} message` });
    const res = await createApp(adapter).request("/api/dlsite/RJ000001/fetch", { method: "POST" });
    assert.equal(res.status, status);
    const body = await res.json();
    assert.equal(body.error.code, kind);
    assert.equal(body.error.message, `${kind} message`);
  }
});

test("GET /api/dlsite/bulk は実行中・終了後の状態をPOSTのjobId付きで返し、未実行時は両方null", async () => {
  const app = createApp(createFixtureAdapter());
  const idle = await app.request("/api/dlsite/bulk");
  assert.equal(idle.status, 200);
  assert.deepEqual(await idle.json(), { current: null, lastTerminal: null });

  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const adapter = createFixtureAdapter();
  adapter.runDlsiteBulk = async (_mode, _workIds, options) => {
    await gate;
    options?.signal?.throwIfAborted();
    return { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 };
  };
  const gatedApp = createApp(adapter);

  const start = await gatedApp.request("/api/dlsite/bulk", { method: "POST" });
  assert.equal(start.status, 202);
  const { jobId } = await start.json();
  assert.equal(typeof jobId, "string");
  await new Promise((resolve) => setImmediate(resolve));
  const running = await gatedApp.request("/api/dlsite/bulk");
  assert.equal(running.status, 200);
  const runningBody = await running.json();
  assert.equal(runningBody.current.status, "running");
  assert.equal(runningBody.current.jobId, jobId);

  release();
  await new Promise((resolve) => setImmediate(resolve));
  const completed = await gatedApp.request("/api/dlsite/bulk");
  assert.equal(completed.status, 200);
  const completedBody = await completed.json();
  assert.equal(completedBody.current, null);
  assert.equal(completedBody.lastTerminal.status, "complete");
  assert.equal(completedBody.lastTerminal.jobId, jobId);
});

test("DLsite一括取得は202で開始し、SSEに進捗と完了件数を配信する", async () => {
  const app = createApp(createFixtureAdapter());
  const start = await app.request("/api/dlsite/bulk", { method: "POST" });
  assert.equal(start.status, 202);
  const events = await app.request("/api/dlsite/events");
  assert.equal(events.status, 200);
  const text = await events.text();
  assert.match(text, /event: complete/);
  assert.match(text, /"fetched":/);
  assert.match(text, /"failed":0/);
});

test("DELETE /api/dlsite/bulk は実行中ジョブの取消を要求し、終了済みには404", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const adapter = createFixtureAdapter();
  adapter.runDlsiteBulk = async (_mode, _workIds, options) => {
    await gate;
    options?.signal?.throwIfAborted();
    return { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 };
  };
  const app = createApp(adapter);
  const start = await app.request("/api/dlsite/bulk", { method: "POST" });
  assert.equal(start.status, 202);
  await new Promise((resolve) => setImmediate(resolve));
  const cancelling = await app.request("/api/dlsite/bulk", { method: "DELETE" });
  assert.equal(cancelling.status, 200);
  assert.deepEqual(await cancelling.json(), { cancelling: true });
  release();
  await new Promise((resolve) => setImmediate(resolve));
  const idle = await app.request("/api/dlsite/bulk", { method: "DELETE" });
  assert.equal(idle.status, 404);
});

test("POST /api/__test__/reset は実行中スキャンを取消して完了待ちしてからfixture状態を戻す", async () => {
  const adapter = createFixtureAdapter();
  adapter.scan = async (options) => {
    const signal = options?.signal;
    if (!signal) throw new Error("missing signal");
    while (!signal.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw signal.reason ?? new Error("aborted");
  };
  const app = createApp(adapter);

  const start = await app.request("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(start.status, 202);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await app.request("/api/scan/active")).status, 200);

  const reset = await app.request("/api/__test__/reset", { method: "POST" });
  assert.equal(reset.status, 200);
  assert.deepEqual(await reset.json(), { ok: true });
  assert.equal((await app.request("/api/scan/active")).status, 204);

  const restart = await app.request("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(restart.status, 202);
});

test("POST /api/__test__/reset は実行中DLsite一括取得を取消して完了待ちしてからfixture状態を戻す", async () => {
  const adapter = createFixtureAdapter();
  adapter.runDlsiteBulk = async (_mode, _workIds, options) => {
    const signal = options?.signal;
    if (!signal) throw new Error("missing signal");
    while (!signal.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    return { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 };
  };
  const app = createApp(adapter);

  const start = await app.request("/api/dlsite/bulk", { method: "POST" });
  assert.equal(start.status, 202);
  await new Promise((resolve) => setImmediate(resolve));
  const running = await app.request("/api/dlsite/bulk");
  assert.equal(running.status, 200);
  assert.equal((await running.json()).current.status, "running");

  const reset = await app.request("/api/__test__/reset", { method: "POST" });
  assert.equal(reset.status, 200);
  assert.deepEqual(await reset.json(), { ok: true });
  const afterReset = await app.request("/api/dlsite/bulk");
  assert.equal(afterReset.status, 200);
  const afterResetBody = await afterReset.json();
  assert.equal(afterResetBody.current, null);
  assert.equal(afterResetBody.lastTerminal.status, "cancelled");

  const restart = await app.request("/api/dlsite/bulk", { method: "POST" });
  assert.equal(restart.status, 202);
});
