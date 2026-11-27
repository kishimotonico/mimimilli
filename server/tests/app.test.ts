// HTTP route の基本疎通・バリデーション・エラー写像。データに依存するケースは fixture / real の両方で、
// adapter の戻り値だけに依存するケース（取得分類→HTTPコード、ジョブ状態、fixture専用APIなど）は
// fixture ベースで adapter メソッドを差し替えて検証する。
import { test } from "node:test";
import assert from "node:assert/strict";
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

const ALL_WORKS = "/api/smart-folders/all/works?sort=added-desc";
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

contract(
  "GET /api/smart-folders/:id/works は登録済みの全作品を {items, total} で返す",
  async (harness) => {
    const { status, body } = await harness.json(ALL_WORKS);
    assert.equal(status, 200);
    assert.equal(body.total, ALL_IDS.length);
    assert.deepEqual(sortedIds(body.items), idsOf(harness, ["a", "b", "c"]));
  },
);

contract(
  "GET /api/smart-folders/:id/works は複数の tags を配列で受け、タグ内のカンマを保持する",
  async (harness) => {
    const matched = await harness.json(`${ALL_WORKS}&tags=tag%2Cone&tags=ASMR`);
    assert.equal(matched.status, 200);
    assert.deepEqual(sortedIds(matched.body.items), idsOf(harness, ["a"]));

    const split = await harness.json(`${ALL_WORKS}&tags=tag&tags=one`);
    assert.equal(split.status, 200);
    assert.equal(split.body.total, 0);
  },
);

contract(
  "GET /api/smart-folders/:id/works は擬似タグとして解釈できない @ 始まりのtagsを400で拒否する",
  async (harness) => {
    for (const badTag of ["@year", "@year/", "@/2024", "@year/banana", "@unknown/2024"]) {
      const { status, body } = await harness.json(
        `${ALL_WORKS}&tags=${encodeURIComponent(badTag)}`,
      );
      assert.equal(status, 400, badTag);
      assert.equal(body.error.code, "invalid_request", badTag);
    }
  },
);

contract(
  "GET /api/smart-folders/:id/works は正しい @year/YYYY 擬似タグで追加年に絞り込む",
  async (harness) => {
    const thisYear = await harness.json(`${ALL_WORKS}&tags=${encodeURIComponent(`@year/${YEAR}`)}`);
    assert.equal(thisYear.status, 200);
    assert.equal(thisYear.body.total, ALL_IDS.length);

    const otherYear = await harness.json(`${ALL_WORKS}&tags=${encodeURIComponent("@year/1999")}`);
    assert.equal(otherYear.status, 200);
    assert.equal(otherYear.body.total, 0);
  },
);

contract(
  "GET /api/smart-folders/:id/works は先頭に空白を挟んだ擬似タグも正規化後の値で判定し受理する",
  async (harness) => {
    const { status, body } = await harness.json(
      `${ALL_WORKS}&tags=${encodeURIComponent(` @year/${YEAR}`)}`,
    );
    assert.equal(status, 200);
    assert.equal(body.total, ALL_IDS.length);
  },
);

const CTX = { now: Date.parse("2026-06-15T12:00:00.000Z") };
const ALL_CONDITION = { type: "and" as const, children: [] };

contract(
  "adapterのqueryWorks(条件の木)は ids で絞り込み、ページングと組み合わせられる",
  async (harness) => {
    const subset = await harness.adapter.queryWorks(
      {
        condition: ALL_CONDITION,
        sort: "id-asc",
        page: 1,
        limit: 10,
        ids: [harness.workId("a"), harness.workId("c")],
      },
      CTX,
    );
    assert.deepEqual(sortedIds(subset.items), idsOf(harness, ["a", "c"]));
    assert.equal(subset.total, 2);

    const paged = await harness.adapter.queryWorks(
      {
        condition: ALL_CONDITION,
        sort: "id-asc",
        page: 1,
        limit: 1,
        ids: ["a", "b", "c"].map((key) => harness.workId(key)),
      },
      CTX,
    );
    assert.deepEqual(
      paged.items.map((item) => item.id),
      [idsOf(harness, ["a", "b", "c"])[0]],
    );
    assert.equal(paged.total, 3);
  },
);

contract(
  "adapterのqueryWorks(条件の木)は数万件のidsを渡しても束縛数の上限に当たらない",
  async (harness) => {
    const unknown = Array.from({ length: 40000 }, (_, index) => `unknown-${index}`);
    const page = await harness.adapter.queryWorks(
      {
        condition: ALL_CONDITION,
        sort: "id-asc",
        page: 1,
        limit: 10,
        ids: [...unknown, harness.workId("b")],
      },
      CTX,
    );
    assert.deepEqual(sortedIds(page.items), idsOf(harness, ["b"]));
    assert.equal(page.total, 1);
  },
);

contract("adapterのqueryWorks(条件の木)は空のidsを空集合として扱う", async (harness) => {
  const page = await harness.adapter.queryWorks(
    { condition: ALL_CONDITION, sort: "id-asc", page: 1, limit: 10, ids: [] },
    CTX,
  );
  assert.equal(page.total, 0);
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

contract("GET /api/fs はルートの listing を返す", async (harness) => {
  const { status, body } = await harness.json("/api/fs");
  assert.equal(status, 200);
  assert.equal(body.path, null);
  assert.ok(Array.isArray(body.entries));
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

test("GET /api/dlsite/jobs/current は実行中・終了後のジョブをPOSTのjobId付きで返し、未実行時はnull", async () => {
  const app = createApp(createFixtureAdapter());
  const idle = await app.request("/api/dlsite/jobs/current");
  assert.equal(idle.status, 200);
  assert.equal((await idle.json()).job, null);

  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const adapter = createFixtureAdapter();
  adapter.fetchDlsiteProduct = async (_code, options) => {
    await gate;
    options.signal?.throwIfAborted();
    return { state: "fetched", title: "タイトル", cover: { state: "none" } };
  };
  const gatedApp = createApp(adapter);

  const start = await postJob(gatedApp, { productCodes: ["RJ000001"] });
  assert.equal(start.status, 202);
  const started = await start.json();
  const jobId: string = started.job.jobId;
  assert.equal(typeof jobId, "string");
  assert.equal(typeof started.revision, "number");
  await new Promise((resolve) => setImmediate(resolve));
  const running = await (await gatedApp.request("/api/dlsite/jobs/current")).json();
  assert.equal(running.job.status, "running");
  assert.equal(running.job.jobId, jobId);
  assert.deepEqual(running.job.codes, [
    { productCode: "RJ000001", state: "fetching", revision: running.revision },
  ]);

  release();
  await new Promise((resolve) => setImmediate(resolve));
  const finished = await (await gatedApp.request("/api/dlsite/jobs/current")).json();
  assert.equal(finished.job.status, "finished");
  assert.equal(finished.job.jobId, jobId);
  assert.deepEqual(finished.job.codes, [
    {
      productCode: "RJ000001",
      state: "fetched",
      revision: finished.job.codes[0].revision,
      dlsite: { state: "fetched", title: "タイトル", cover: { state: "none" } },
    },
  ]);
  assert.ok(finished.revision > running.revision);
  assert.ok(finished.revision > finished.job.codes[0].revision);
  assert.deepEqual(finished.job.progress, { processed: 1, total: 1 });
});

test("DLsite取得ジョブは202で開始し、SSEにsnapshotと完了を配信する", async () => {
  const app = createApp(createFixtureAdapter());
  const start = await postJob(app, { productCodes: ["RJ000001", "rj000002"] });
  assert.equal(start.status, 202);
  const events = await app.request("/api/dlsite/jobs/events");
  assert.equal(events.status, 200);
  const text = await events.text();
  assert.match(text, /event: snapshot/);
  assert.match(text, /"productCode":"RJ000002"/);
  assert.match(text, /"state":"fetched"/);
});

test("POST /api/dlsite/jobs は不正なコードを400で拒否し、オフラインでは offline で拒否してジョブを作らない", async () => {
  const adapter = createFixtureAdapter();
  const app = createApp(adapter);
  assert.equal((await postJob(app, { productCodes: ["abc"] })).status, 400);
  assert.equal((await postJob(app, { productCodes: [] })).status, 400);

  adapter.isDlsiteOffline = () => true;
  const offline = await postJob(app, { productCodes: ["RJ000001"] });
  assert.equal(offline.status, 503);
  assert.equal((await offline.json()).error.code, "offline");
  assert.equal((await (await app.request("/api/dlsite/jobs/current")).json()).job, null);
});

test("DELETE /api/dlsite/jobs/:jobId は待機中のまとめてだけを外し、別のIDや対象なしは removed: 0", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const adapter = createFixtureAdapter();
  adapter.fetchDlsiteProduct = async () => {
    await gate;
    return { state: "fetched", title: "タイトル", cover: { state: "none" } };
  };
  const app = createApp(adapter);
  const start = await postJob(app, {
    productCodes: ["RJ000001", "RJ000002", "RJ000003"],
  });
  const jobId: string = (await start.json()).job.jobId;
  await new Promise((resolve) => setImmediate(resolve));
  const other = await app.request("/api/dlsite/jobs/other", { method: "DELETE" });
  assert.deepEqual(await other.json(), { removed: 0 });
  const cancelled = await app.request(`/api/dlsite/jobs/${jobId}`, { method: "DELETE" });
  assert.equal(cancelled.status, 200);
  assert.deepEqual(await cancelled.json(), { removed: 2 });
  release();
  await new Promise((resolve) => setImmediate(resolve));
  const again = await app.request(`/api/dlsite/jobs/${jobId}`, { method: "DELETE" });
  assert.deepEqual(await again.json(), { removed: 0 });
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

test("POST /api/__test__/reset は実行中DLsite取得ジョブを打ち切って完了待ちしてからfixture状態を戻す", async () => {
  const adapter = createFixtureAdapter();
  adapter.fetchDlsiteProduct = async (_code, options) => {
    const signal = options.signal;
    if (!signal) throw new Error("missing signal");
    while (!signal.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw signal.reason;
  };
  const app = createApp(adapter);

  const start = await postJob(app, { productCodes: ["RJ000001", "RJ000002"] });
  assert.equal(start.status, 202);
  await new Promise((resolve) => setImmediate(resolve));
  const running = await (await app.request("/api/dlsite/jobs/current")).json();
  assert.equal(running.job.status, "running");

  const reset = await app.request("/api/__test__/reset", { method: "POST" });
  assert.equal(reset.status, 200);
  assert.deepEqual(await reset.json(), { ok: true });
  assert.equal((await (await app.request("/api/dlsite/jobs/current")).json()).job, null);

  const restart = await postJob(app, { productCodes: ["RJ000001"] });
  assert.equal(restart.status, 202);
});

function postJob(app: ReturnType<typeof createApp>, body: unknown): Promise<Response> {
  return Promise.resolve(
    app.request("/api/dlsite/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
