import assert from "node:assert/strict";
import { test } from "node:test";
import type { DlsiteBulkProgressSnapshot } from "@mimimilli/shared";
import { createDlsiteBulk } from "../src/adapters/real/dlsiteBulk.ts";
import type { DlsiteFetchAttempt } from "../src/adapters/real/dlsiteFetch.ts";

type FetchAttempt = (
  rjCode: string,
  force: boolean,
  signal?: AbortSignal,
) => Promise<DlsiteFetchAttempt>;

const okAttempt: DlsiteFetchAttempt = {
  result: { ok: true } as DlsiteFetchAttempt["result"],
  httpAttempted: true,
};

function failedAttempt(kind: "error" | "parse_error"): DlsiteFetchAttempt {
  return { result: { ok: false, kind, message: kind }, httpAttempted: true };
}

function setup(works: Array<{ id: string; rjCode: string }>, fetchAttempt: FetchAttempt) {
  const summaries = works.map((work) => ({
    id: work.id,
    title: `title-${work.id}`,
    dlsite: { status: "none", rjCode: work.rjCode },
  }));
  const refreshed: string[] = [];
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  const bulk = createDlsiteBulk({
    query: { listSummaries: () => ({ summaries, skipped: [] }) },
    catalog: {
      getWorkMetaPath: (id: string) => {
        refreshed.push(id);
        return null;
      },
    },
    dlsiteCache: {},
    fetch: {
      dlsiteLogger: logger,
      dlsiteScheduler: { drain: async () => {} },
      fetchCachedDlsiteAttempt: fetchAttempt,
    },
  } as unknown as Parameters<typeof createDlsiteBulk>[0]);
  return { bulk, refreshed };
}

test("一括取得は作品1件の処理が終わるたびに進捗を通知し、次に処理する作品を示す", async () => {
  const { bulk } = setup(
    [
      { id: "w1", rjCode: "RJ000001" },
      { id: "w2", rjCode: "RJ000002" },
    ],
    async () => okAttempt,
  );
  const events: DlsiteBulkProgressSnapshot[] = [];
  const result = await bulk.runDlsiteBulk("existing", undefined, {
    onProgress: (progress) => events.push(progress),
  });
  assert.deepEqual(result, { fetched: 2, failed: 0, parseErrors: 0, skipped: 0 });
  assert.deepEqual(events, [
    { processed: 0, total: 2, work: { id: "w1", rjCode: "RJ000001", title: "title-w1" } },
    { processed: 1, total: 2, work: { id: "w2", rjCode: "RJ000002", title: "title-w2" } },
    { processed: 2, total: 2, work: null },
  ]);
});

test("一括取得は取得結果を作品の処理ごとに反映してから次のrjCodeを取得する", async () => {
  const order: string[] = [];
  const { bulk, refreshed } = setup(
    [
      { id: "w1", rjCode: "RJ000001" },
      { id: "w2", rjCode: "RJ000002" },
    ],
    async (rjCode) => {
      order.push(`fetch:${rjCode}:refreshed=${refreshed.length}`);
      return okAttempt;
    },
  );
  await bulk.runDlsiteBulk("existing", undefined);
  assert.deepEqual(order, ["fetch:RJ000001:refreshed=0", "fetch:RJ000002:refreshed=1"]);
  assert.deepEqual(refreshed, ["w1", "w2"]);
});

test("同じrjCodeの作品が複数あっても取得は1回で、進捗のworkは実際の処理順を指す", async () => {
  const fetched: string[] = [];
  const { bulk, refreshed } = setup(
    [
      { id: "w1", rjCode: "RJ000001" },
      { id: "w2", rjCode: "RJ000002" },
      { id: "w3", rjCode: "RJ000001" },
    ],
    async (rjCode) => {
      fetched.push(rjCode);
      return okAttempt;
    },
  );
  const events: DlsiteBulkProgressSnapshot[] = [];
  const result = await bulk.runDlsiteBulk("existing", undefined, {
    onProgress: (progress) => events.push(progress),
  });
  assert.deepEqual(fetched, ["RJ000001", "RJ000002"]);
  assert.deepEqual(refreshed, ["w1", "w3", "w2"]);
  assert.deepEqual(
    events.map((event) => [event.processed, event.work?.id ?? null]),
    [
      [0, "w1"],
      [1, "w3"],
      [2, "w2"],
      [3, null],
    ],
  );
  assert.equal(result.fetched, 3);
});

test("取得失敗・パース失敗・取得例外は作品ごとに件数へ数える", async () => {
  const { bulk } = setup(
    [
      { id: "w1", rjCode: "RJ000001" },
      { id: "w2", rjCode: "RJ000002" },
      { id: "w3", rjCode: "RJ000003" },
      { id: "w4", rjCode: "RJ000004" },
    ],
    async (rjCode) => {
      if (rjCode === "RJ000001") return okAttempt;
      if (rjCode === "RJ000002") return failedAttempt("error");
      if (rjCode === "RJ000003") return failedAttempt("parse_error");
      throw new Error("boom");
    },
  );
  assert.deepEqual(await bulk.runDlsiteBulk("existing", undefined), {
    fetched: 1,
    failed: 3,
    parseErrors: 1,
    skipped: 0,
  });
});

test("取消は処理済みの作品の件数を返し、以降は取得しない", async () => {
  const controller = new AbortController();
  const fetched: string[] = [];
  const { bulk } = setup(
    [
      { id: "w1", rjCode: "RJ000001" },
      { id: "w2", rjCode: "RJ000002" },
      { id: "w3", rjCode: "RJ000003" },
    ],
    async (rjCode) => {
      fetched.push(rjCode);
      if (rjCode === "RJ000002") return failedAttempt("parse_error");
      return okAttempt;
    },
  );
  const result = await bulk.runDlsiteBulk("existing", undefined, {
    signal: controller.signal,
    onProgress: (progress) => {
      if (progress.processed === 2) controller.abort();
    },
  });
  assert.deepEqual(result, { fetched: 1, failed: 1, parseErrors: 1, skipped: 0 });
  assert.deepEqual(fetched, ["RJ000001", "RJ000002"]);
});

test("取得中の取消でも、それまでに処理した作品の件数を返す", async () => {
  const controller = new AbortController();
  const { bulk } = setup(
    [
      { id: "w1", rjCode: "RJ000001" },
      { id: "w2", rjCode: "RJ000002" },
    ],
    async (rjCode) => {
      if (rjCode === "RJ000002") {
        controller.abort();
        throw new DOMException("aborted", "AbortError");
      }
      return okAttempt;
    },
  );
  const result = await bulk.runDlsiteBulk("existing", undefined, { signal: controller.signal });
  assert.deepEqual(result, { fetched: 1, failed: 0, parseErrors: 0, skipped: 0 });
});

test("オフライン（kind: offline の失敗）では全件が失敗に数えられ、投影は更新されず完了する", async () => {
  const { bulk, refreshed } = setup(
    [
      { id: "w1", rjCode: "RJ000001" },
      { id: "w2", rjCode: "RJ000002" },
    ],
    async () => ({
      result: { ok: false, kind: "offline", message: "offline" },
      httpAttempted: false,
    }),
  );
  assert.deepEqual(await bulk.runDlsiteBulk("existing", undefined), {
    fetched: 0,
    failed: 2,
    parseErrors: 0,
    skipped: 0,
  });
  assert.deepEqual(refreshed, []);
});

test("想定外の例外は結果を返さずそのまま投げる", async () => {
  const { bulk } = setup([{ id: "w1", rjCode: "RJ000001" }], async () => okAttempt);
  await assert.rejects(
    bulk.runDlsiteBulk("existing", undefined, {
      onProgress: () => {
        throw new Error("listener broke");
      },
    }),
    /listener broke/,
  );
});
