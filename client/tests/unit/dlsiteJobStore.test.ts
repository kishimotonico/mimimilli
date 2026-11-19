import { describe, expect, it, vi } from "vitest";
import {
  DLSITE_JOB_MAX_PRODUCT_CODES,
  type DlsiteJobEvent,
  type DlsiteJobSnapshot,
} from "@mimimilli/shared";
import { ApiRequestError } from "../../src/shared/api/http";
import {
  createDlsiteJobStore,
  type DlsiteJobDeps,
  type DlsiteJobStoreEvent,
} from "../../src/entities/dlsite/model/dlsiteJobStore";

class FakeEventSource extends EventTarget {
  closed = false;
  readyState = 1;
  onerror: ((event: Event) => void) | null = null;
  close(): void {
    this.closed = true;
    this.readyState = 2;
  }
}

function snapshot(
  jobId: string,
  codes: DlsiteJobSnapshot["codes"] = [],
  status: DlsiteJobSnapshot["status"] = "running",
): DlsiteJobSnapshot {
  const bulkCodes = codes.filter((code) => code.origin === "bulk");
  return {
    jobId,
    status,
    codes,
    bulk: {
      total: bulkCodes.length,
      processed: bulkCodes.filter((code) => code.state !== "queued" && code.state !== "fetching")
        .length,
    },
  };
}

function createHarness(overrides: Partial<DlsiteJobDeps> = {}) {
  const sources: FakeEventSource[] = [];
  const deps: DlsiteJobDeps = {
    startJob: vi.fn(async () => ({ jobId: "job-1" })),
    getCurrent: vi.fn(async () => null),
    cancelBulk: vi.fn(async () => ({ removed: 0 })),
    connect: () => {
      const source = new FakeEventSource();
      sources.push(source);
      return { source: source as unknown as EventSource, close: () => source.close() };
    },
    ...overrides,
  };
  const store = createDlsiteJobStore(deps);
  const events: DlsiteJobStoreEvent[] = [];
  store.subscribeEvents((event) => events.push(event));
  const last = () => sources[sources.length - 1]!;
  return { store, deps, sources, events, last };
}

function dispatch(source: FakeEventSource, event: DlsiteJobEvent): void {
  source.dispatchEvent(new MessageEvent(event.type, { data: JSON.stringify(event) }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const codesOf = (count: number, offset = 0) =>
  Array.from({ length: count }, (_, index) => `RJ${String(100000 + offset + index)}`);
const bulkCode = (productCode: string, state: DlsiteJobSnapshot["codes"][number]["state"]) => ({
  productCode,
  origin: "bulk" as const,
  state,
});

describe("dlsiteJobStore", () => {
  describe("開始", () => {
    it("応答待ちの間に startBulk を2回呼んでも POST は1回", async () => {
      const gate = deferred<{ jobId: string }>();
      const { store, deps } = createHarness({ startJob: vi.fn(() => gate.promise) });
      const first = store.startBulk(["RJ000001"]);
      expect(store.getState().startingBulk).toEqual({ total: 1 });
      await store.startBulk(["RJ000001"]);
      gate.resolve({ jobId: "job-1" });
      await first;
      expect(deps.startJob).toHaveBeenCalledTimes(1);
    });

    it("上限ごとに分割して順に POST し、途中で失敗すると残りは送らず追跡は維持する", async () => {
      const startJob = vi
        .fn()
        .mockResolvedValueOnce({ jobId: "job-1" })
        .mockRejectedValueOnce(new ApiRequestError(500, "internal", "失敗しました"));
      const { store, last } = createHarness({ startJob });
      const result = await store.startBulk(codesOf(2500));
      const sizes = startJob.mock.calls.map(
        ([body]) => (body as { productCodes: string[] }).productCodes.length,
      );
      expect(sizes).toEqual([DLSITE_JOB_MAX_PRODUCT_CODES, DLSITE_JOB_MAX_PRODUCT_CODES]);
      expect(result).toEqual({ ok: false, error: "失敗しました" });
      expect(store.getState().startingBulk).toBeNull();
      expect(store.getState().job?.jobId).toBe("job-1");
      expect(last().closed).toBe(false);
    });

    it("2500件は 1000/1000/500 の3回に分かれる", async () => {
      const startJob = vi.fn(async () => ({ jobId: "job-1" }));
      const { store } = createHarness({ startJob });
      await store.startBulk(codesOf(2500));
      expect(
        startJob.mock.calls.map(
          ([body]) => (body as { productCodes: string[] }).productCodes.length,
        ),
      ).toEqual([1000, 1000, 500]);
    });

    it("分割中にジョブが変わると前のジョブの finished を1回出して新しいほうを追跡する", async () => {
      const startJob = vi
        .fn()
        .mockResolvedValueOnce({ jobId: "job-1" })
        .mockResolvedValueOnce({ jobId: "job-2" });
      const { store, events } = createHarness({ startJob });
      await store.startBulk(codesOf(1500));
      expect(events).toEqual([{ type: "finished", jobId: "job-1", affected: { kind: "unknown" } }]);
      expect(store.getState().job?.jobId).toBe("job-2");
    });

    it("startingBulk は最後の応答のあと、状態を受け取った時点で外れる", async () => {
      const { store, last } = createHarness();
      await store.startBulk(["RJ000001"]);
      expect(store.getState().startingBulk).toEqual({ total: 1 });
      dispatch(last(), {
        type: "snapshot",
        job: snapshot("job-1", [bulkCode("RJ000001", "queued")]),
      });
      expect(store.getState().startingBulk).toBeNull();
    });

    it("offline は error を返すが state.error には入れない", async () => {
      const startJob = vi.fn(async () => {
        throw new ApiRequestError(503, "offline", "オフラインです");
      });
      const { store } = createHarness({ startJob });
      expect(await store.startBulk(["RJ000001"])).toEqual({ ok: false, error: "オフラインです" });
      expect(store.getState().error).toBeNull();
      expect(store.getState().startingBulk).toBeNull();
    });
  });

  describe("応答待ち中の reset", () => {
    it.each([
      [
        "startBulk",
        (store: ReturnType<typeof createHarness>["store"]) => store.startBulk(["RJ000001"]),
      ],
      [
        "startSingle",
        (store: ReturnType<typeof createHarness>["store"]) => store.startSingle("RJ000001"),
      ],
    ])("%s は応答前に reset すると SSE を開かない", async (_name, run) => {
      const gate = deferred<{ jobId: string }>();
      const { store, sources } = createHarness({ startJob: vi.fn(() => gate.promise) });
      const pending = run(store);
      store.reset();
      gate.resolve({ jobId: "job-1" });
      await pending;
      expect(sources).toHaveLength(0);
      expect(store.getState().job).toBeNull();
    });

    it("attach は応答前に reset すると SSE を開かない", async () => {
      const gate = deferred<DlsiteJobSnapshot | null>();
      const { store, sources } = createHarness({ getCurrent: vi.fn(() => gate.promise) });
      const pending = store.attach();
      store.reset();
      gate.resolve(snapshot("job-1"));
      await pending;
      expect(sources).toHaveLength(0);
    });

    it("reset で接続を閉じ状態を空にする", async () => {
      const { store, last } = createHarness({ getCurrent: vi.fn(async () => snapshot("job-1")) });
      await store.attach();
      store.reset();
      expect(last().closed).toBe(true);
      expect(store.getState().job).toBeNull();
    });
  });

  describe("attach", () => {
    it("実行中のジョブを追跡し、finished・null では何もしない", async () => {
      const running = createHarness({ getCurrent: vi.fn(async () => snapshot("job-1")) });
      await running.store.attach();
      expect(running.sources).toHaveLength(1);
      await running.store.attach();
      expect(running.sources).toHaveLength(1);

      const done = createHarness({
        getCurrent: vi.fn(async () => snapshot("job-1", [], "finished")),
      });
      await done.store.attach();
      expect(done.sources).toHaveLength(0);
      const none = createHarness();
      await none.store.attach();
      expect(none.sources).toHaveLength(0);
    });
  });

  describe("終端", () => {
    it("finished を2回・snapshot(finished)＋finished でも finished イベントは1回", async () => {
      const { store, events, last } = createHarness();
      await store.startBulk(["RJ000001"]);
      const source = last();
      dispatch(source, {
        type: "snapshot",
        job: snapshot("job-1", [bulkCode("RJ000001", "fetched")], "finished"),
      });
      dispatch(source, { type: "finished", jobId: "job-1", reason: "complete" });
      dispatch(source, { type: "finished", jobId: "job-1", reason: "complete" });
      expect(events).toEqual([
        {
          type: "finished",
          jobId: "job-1",
          affected: { kind: "codes", productCodes: ["RJ000001"] },
        },
      ]);
      expect(source.closed).toBe(true);
      expect(store.getState().job?.status).toBe("finished");
      expect(store.getState().settled).toBe(false);
      store.markSettled("job-1");
      expect(store.getState().settled).toBe(true);
    });

    it("finished イベントで終端し、終端に達したコードだけを通知する", async () => {
      const { store, events, last } = createHarness();
      await store.startBulk(["RJ000001", "RJ000002"]);
      dispatch(last(), {
        type: "snapshot",
        job: snapshot("job-1", [bulkCode("RJ000001", "fetched"), bulkCode("RJ000002", "queued")]),
      });
      dispatch(last(), { type: "finished", jobId: "job-1", reason: "aborted" });
      expect(events).toEqual([
        {
          type: "finished",
          jobId: "job-1",
          affected: { kind: "codes", productCodes: ["RJ000001"] },
        },
      ]);
    });

    it("code イベントで行の状態と bulk を更新し、終端状態なら codesTerminal を出す", async () => {
      const { store, events, last } = createHarness();
      await store.startBulk(["RJ000001"]);
      dispatch(last(), {
        type: "snapshot",
        job: snapshot("job-1", [bulkCode("RJ000001", "queued")]),
      });
      dispatch(last(), {
        type: "code",
        jobId: "job-1",
        productCode: "RJ000001",
        origin: "bulk",
        state: "fetching",
        bulk: { processed: 0, total: 1 },
      });
      expect(events).toEqual([]);
      dispatch(last(), {
        type: "code",
        jobId: "job-1",
        productCode: "RJ000001",
        origin: "bulk",
        state: "fetched",
        bulk: { processed: 1, total: 1 },
      });
      expect(store.getState().job?.codes.get("RJ000001")?.state).toBe("fetched");
      expect(store.getState().job?.bulk).toEqual({ processed: 1, total: 1 });
      expect(events).toEqual([
        { type: "codesTerminal", jobId: "job-1", origin: "bulk", productCodes: ["RJ000001"] },
      ]);
    });

    it("不正なイベントで接続を閉じ、job を null にして error を立て、finished を出す", async () => {
      const { store, events, last } = createHarness();
      await store.startBulk(["RJ000001"]);
      last().dispatchEvent(new MessageEvent("code", { data: JSON.stringify({ type: "code" }) }));
      expect(last().closed).toBe(true);
      expect(store.getState().job).toBeNull();
      expect(store.getState().error).not.toBeNull();
      expect(events.map((event) => event.type)).toEqual(["finished"]);
      store.clearError();
      expect(store.getState().error).toBeNull();
    });
  });

  describe("切断からの復旧と追跡外 jobId", () => {
    it("エラー時に GET して、同じIDで running かつ接続が CONNECTING なら追跡を維持する", async () => {
      const { store, sources, last } = createHarness({
        getCurrent: vi.fn(async () => snapshot("job-1", [bulkCode("RJ000001", "fetched")])),
      });
      await store.startBulk(["RJ000001"]);
      last().onerror?.(new Event("error"));
      await flush();
      expect(sources).toHaveLength(1);
      expect(store.getState().job?.codes.get("RJ000001")?.state).toBe("fetched");
    });

    it("接続が CLOSED なら張り直す", async () => {
      const { store, sources, last } = createHarness({
        getCurrent: vi.fn(async () => snapshot("job-1")),
      });
      await store.startBulk(["RJ000001"]);
      last().readyState = 2;
      last().onerror?.(new Event("error"));
      await flush();
      expect(sources).toHaveLength(2);
      expect(store.getState().job?.jobId).toBe("job-1");
    });

    it("GET が null なら追跡中のジョブを終端扱いにする", async () => {
      const { store, events, last } = createHarness({ getCurrent: vi.fn(async () => null) });
      await store.startBulk(["RJ000001"]);
      last().onerror?.(new Event("error"));
      await flush();
      expect(events.map((event) => event.type)).toEqual(["finished"]);
      expect(store.getState().job?.status).toBe("finished");
    });

    it("ジョブAの取得中に切断してジョブBで再接続すると、Aは終わりを受け取れなかった扱いで終端する", async () => {
      const { store, events, last } = createHarness({
        getCurrent: vi.fn(async () => snapshot("job-2")),
      });
      await store.startBulk(["RJ000001"]);
      dispatch(last(), {
        type: "snapshot",
        job: snapshot("job-1", [bulkCode("RJ000001", "fetched")]),
      });
      last().onerror?.(new Event("error"));
      await flush();
      expect(events).toEqual([{ type: "finished", jobId: "job-1", affected: { kind: "unknown" } }]);
    });

    it("違う jobId が running なら終端してから乗り換える", async () => {
      const { store, events, sources, last } = createHarness({
        getCurrent: vi.fn(async () => snapshot("job-2")),
      });
      await store.startBulk(["RJ000001"]);
      last().onerror?.(new Event("error"));
      await flush();
      expect(events.filter((event) => event.type === "finished")).toHaveLength(1);
      expect(sources).toHaveLength(2);
      expect(store.getState().job?.jobId).toBe("job-2");
    });

    it("追跡外 jobId の code イベントで GET して確定する（null なら終端）", async () => {
      const { store, events, last } = createHarness({ getCurrent: vi.fn(async () => null) });
      await store.startBulk(["RJ000001"]);
      dispatch(last(), {
        type: "code",
        jobId: "other",
        productCode: "RJ000001",
        origin: "bulk",
        state: "fetched",
        bulk: { processed: 1, total: 1 },
      });
      await flush();
      expect(events.map((event) => event.type)).toEqual(["finished"]);
    });

    it("何も受け取らないまま CLOSED が3回続くと error を立てて追跡を終える", async () => {
      const { store, sources, last } = createHarness({
        getCurrent: vi.fn(async () => snapshot("job-1")),
      });
      await store.startBulk(["RJ000001"]);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        last().readyState = 2;
        last().onerror?.(new Event("error"));
        await flush();
      }
      expect(sources).toHaveLength(3);
      expect(store.getState().error).not.toBeNull();
      expect(store.getState().job).toBeNull();
    });

    it("GET の失敗では追跡を保つ", async () => {
      const { store, last } = createHarness({
        getCurrent: vi.fn(async () => {
          throw new Error("network");
        }),
      });
      await store.startBulk(["RJ000001"]);
      last().onerror?.(new Event("error"));
      await flush();
      expect(store.getState().job?.jobId).toBe("job-1");
      expect(store.getState().error).toBeNull();
    });
  });

  describe("409 root_reconfiguring", () => {
    const rootReconfiguring = () =>
      new ApiRequestError(409, "root_reconfiguring", "ルートを再設定中です");

    it("POST・GET・DELETE のどれでも reset され error は立たない", async () => {
      const post = createHarness({
        startJob: vi.fn(async () => {
          throw rootReconfiguring();
        }),
      });
      await post.store.startBulk(["RJ000001"]);
      expect(post.store.getState().error).toBeNull();
      expect(post.store.getState().startingBulk).toBeNull();

      const get = createHarness({
        getCurrent: vi.fn(async () => {
          throw rootReconfiguring();
        }),
      });
      await get.store.startBulk(["RJ000001"]);
      get.last().onerror?.(new Event("error"));
      await flush();
      expect(get.store.getState().job).toBeNull();
      expect(get.store.getState().error).toBeNull();
      expect(get.last().closed).toBe(true);

      const del = createHarness({
        cancelBulk: vi.fn(async () => {
          throw rootReconfiguring();
        }),
      });
      await del.store.startBulk(["RJ000001"]);
      dispatch(del.last(), {
        type: "snapshot",
        job: snapshot("job-1", [bulkCode("RJ000001", "queued")]),
      });
      await del.store.cancelBulk();
      expect(del.store.getState().job).toBeNull();
      expect(del.store.getState().error).toBeNull();
    });
  });

  describe("単発", () => {
    it("startSingle 直後から pendingSingles に入り、code を受けるまで外れない。失敗で外れる", async () => {
      const gate = deferred<{ jobId: string }>();
      const startJob = vi.fn(() => gate.promise);
      const { store, last } = createHarness({ startJob });
      const pending = store.startSingle("rj000001");
      expect(store.getState().pendingSingles.has("RJ000001")).toBe(true);
      gate.resolve({ jobId: "job-1" });
      await pending;
      expect(store.getState().pendingSingles.has("RJ000001")).toBe(true);
      dispatch(last(), {
        type: "snapshot",
        job: snapshot("job-1", [{ productCode: "RJ000001", origin: "single", state: "queued" }]),
      });
      expect(store.getState().pendingSingles.size).toBe(0);

      const failing = createHarness({
        startJob: vi.fn(async () => {
          throw new ApiRequestError(409, "conflict", "終了処理中です");
        }),
      });
      expect(await failing.store.startSingle("RJ000002")).toEqual({
        ok: false,
        error: "終了処理中です",
      });
      expect(failing.store.getState().pendingSingles.size).toBe(0);
    });

    it("同じコードが保留中なら POST しない", async () => {
      const gate = deferred<{ jobId: string }>();
      const { store, deps } = createHarness({ startJob: vi.fn(() => gate.promise) });
      const first = store.startSingle("RJ000001");
      await store.startSingle("RJ000001");
      gate.resolve({ jobId: "job-1" });
      await first;
      expect(deps.startJob).toHaveBeenCalledTimes(1);
    });

    it("応答より先に待機中の code を受け取っていれば保留は残らない", async () => {
      const gate = deferred<{ jobId: string }>();
      const { store, last } = createHarness({
        startJob: vi.fn(() => gate.promise),
        getCurrent: vi.fn(async () => snapshot("job-1")),
      });
      await store.attach();
      const pending = store.startSingle("RJ000001");
      dispatch(last(), {
        type: "code",
        jobId: "job-1",
        productCode: "RJ000001",
        origin: "single",
        state: "queued",
        bulk: { processed: 0, total: 0 },
      });
      gate.resolve({ jobId: "job-1" });
      await pending;
      expect(store.getState().pendingSingles.size).toBe(0);
    });
  });

  describe("単発の保留と応答順", () => {
    const singleOf = (state: "queued" | "fetched" | "failed") => ({
      productCode: "RJ000001",
      origin: "single" as const,
      state,
    });

    it("終端の code イベントが POST 応答より先に届いても、応答で保留が外れる", async () => {
      const gate = deferred<{ jobId: string }>();
      const { store, last } = createHarness({
        startJob: vi.fn(() => gate.promise),
        getCurrent: vi.fn(async () => snapshot("job-1")),
      });
      await store.attach();
      const pending = store.startSingle("RJ000001");
      dispatch(last(), {
        type: "code",
        jobId: "job-1",
        productCode: "RJ000001",
        origin: "single",
        state: "fetched",
        bulk: { processed: 0, total: 0 },
      });
      expect(store.getState().pendingSingles.has("RJ000001")).toBe(true);
      gate.resolve({ jobId: "job-1" });
      await pending;
      expect(store.getState().pendingSingles.size).toBe(0);
    });

    it("POST 中の再接続で snapshot から終端を直接受け取っても、応答で保留が外れる", async () => {
      const gate = deferred<{ jobId: string }>();
      const { store, last } = createHarness({
        startJob: vi.fn(() => gate.promise),
        getCurrent: vi.fn(async () => snapshot("job-1")),
      });
      await store.attach();
      const pending = store.startSingle("RJ000001");
      dispatch(last(), { type: "snapshot", job: snapshot("job-1", [singleOf("failed")]) });
      gate.resolve({ jobId: "job-1" });
      await pending;
      expect(store.getState().pendingSingles.size).toBe(0);
    });

    it("POST 中に前のジョブで受けた状態は、応答でジョブが変わったあとの保留解除に使わない", async () => {
      const gate = deferred<{ jobId: string }>();
      const { store, last } = createHarness({
        startJob: vi.fn(() => gate.promise),
        getCurrent: vi.fn(async () => snapshot("job-1")),
      });
      await store.attach();
      const pending = store.startSingle("RJ000001");
      dispatch(last(), {
        type: "code",
        jobId: "job-1",
        productCode: "RJ000001",
        origin: "bulk",
        state: "fetched",
        bulk: { processed: 1, total: 1 },
      });
      gate.resolve({ jobId: "job-2" });
      await pending;
      expect(store.getState().job?.jobId).toBe("job-2");
      expect(store.getState().pendingSingles.has("RJ000001")).toBe(true);
    });

    it("開始より前に受け取った終端状態だけが残るコードは、応答後も取り直しの状態まで保留する", async () => {
      const gate = deferred<{ jobId: string }>();
      const { store, last } = createHarness({
        startJob: vi.fn(() => gate.promise),
        getCurrent: vi.fn(async () => snapshot("job-1", [singleOf("fetched")])),
      });
      await store.attach();
      const pending = store.startSingle("RJ000001");
      gate.resolve({ jobId: "job-1" });
      await pending;
      expect(store.getState().pendingSingles.has("RJ000001")).toBe(true);
      dispatch(last(), {
        type: "code",
        jobId: "job-1",
        productCode: "RJ000001",
        origin: "single",
        state: "queued",
        bulk: { processed: 0, total: 0 },
      });
      expect(store.getState().pendingSingles.size).toBe(0);
    });
  });

  describe("単発の保留と古い照会", () => {
    it("POST より前に発行した照会が POST 中に返っても、その終端では保留を外さない", async () => {
      const post = deferred<{ jobId: string }>();
      const stale = deferred<DlsiteJobSnapshot>();
      const getCurrent = vi
        .fn<DlsiteJobDeps["getCurrent"]>()
        .mockResolvedValueOnce(snapshot("job-1"))
        .mockReturnValueOnce(stale.promise);
      const { store, last } = createHarness({ startJob: vi.fn(() => post.promise), getCurrent });
      await store.attach();
      last().onerror?.(new Event("error"));
      const pending = store.startSingle("RJ000001");
      stale.resolve(
        snapshot("job-1", [{ productCode: "RJ000001", origin: "single", state: "fetched" }]),
      );
      await flush();
      post.resolve({ jobId: "job-1" });
      await pending;
      expect(store.getState().pendingSingles.has("RJ000001")).toBe(true);
    });

    it("応答で別のジョブに乗り換えても、そのコードの状態を受け取るまで保留は外れない", async () => {
      const { store } = createHarness({
        startJob: vi.fn(async () => ({ jobId: "job-2" })),
        getCurrent: vi.fn(async () => snapshot("job-1")),
      });
      await store.attach();
      await store.startSingle("RJ000001");
      expect(store.getState().job?.jobId).toBe("job-2");
      expect(store.getState().pendingSingles.has("RJ000001")).toBe(true);
    });
  });

  describe("中止", () => {
    it("起点がまとめてで queued のコードが無ければ DELETE を送らない", async () => {
      const { store, deps, last } = createHarness();
      await store.startBulk(["RJ000001"]);
      dispatch(last(), {
        type: "snapshot",
        job: snapshot("job-1", [
          bulkCode("RJ000001", "fetching"),
          { productCode: "RJ000002", origin: "single", state: "queued" },
        ]),
      });
      await store.cancelBulk();
      expect(deps.cancelBulk).not.toHaveBeenCalled();
    });

    it("DELETE を送り、removed イベントで codes と bulk が更新される", async () => {
      const { store, deps, last } = createHarness();
      await store.startBulk(["RJ000001", "RJ000002"]);
      dispatch(last(), {
        type: "snapshot",
        job: snapshot("job-1", [bulkCode("RJ000001", "fetching"), bulkCode("RJ000002", "queued")]),
      });
      await store.cancelBulk();
      expect(deps.cancelBulk).toHaveBeenCalledWith("job-1");
      expect(store.getState().cancelling).toBe(false);
      dispatch(last(), {
        type: "removed",
        jobId: "job-1",
        productCodes: ["RJ000002"],
        bulk: { processed: 0, total: 1 },
      });
      expect([...store.getState().job!.codes.keys()]).toEqual(["RJ000001"]);
      expect(store.getState().job?.bulk).toEqual({ processed: 0, total: 1 });
    });
  });

  describe("競合と取りこぼしの防止", () => {
    const codeEvent = (state: "queued" | "fetching" | "fetched"): DlsiteJobEvent => ({
      type: "code",
      jobId: "job-1",
      productCode: "RJ000001",
      origin: "bulk",
      state,
      bulk: { processed: state === "fetched" ? 1 : 0, total: 1 },
    });

    it("遅れて届いた GET の結果は、発行後に受けた code の終端状態を巻き戻さない", async () => {
      const gate = deferred<DlsiteJobSnapshot | null>();
      const { store, last } = createHarness({ getCurrent: vi.fn(() => gate.promise) });
      await store.startBulk(["RJ000001"]);
      dispatch(last(), {
        type: "snapshot",
        job: snapshot("job-1", [bulkCode("RJ000001", "fetching")]),
      });
      last().onerror?.(new Event("error"));
      dispatch(last(), codeEvent("fetched"));
      gate.resolve(snapshot("job-1", [bulkCode("RJ000001", "fetching")]));
      await flush();
      expect(store.getState().job?.codes.get("RJ000001")?.state).toBe("fetched");
      expect(store.getState().job?.bulk).toEqual({ processed: 1, total: 1 });
    });

    it("発行後に code を受けていても、GET の finished は終端として使う", async () => {
      const gate = deferred<DlsiteJobSnapshot | null>();
      const { store, events, last } = createHarness({ getCurrent: vi.fn(() => gate.promise) });
      await store.startBulk(["RJ000001"]);
      last().onerror?.(new Event("error"));
      dispatch(last(), codeEvent("fetching"));
      gate.resolve(snapshot("job-1", [bulkCode("RJ000001", "fetched")], "finished"));
      await flush();
      expect(events.map((event) => event.type)).toEqual(["finished"]);
      expect(store.getState().job?.status).toBe("finished");
    });

    it("reset のあとに古い接続から届いたイベントは無視する", async () => {
      const { store, events, last } = createHarness();
      await store.startBulk(["RJ000001"]);
      const stale = last();
      store.reset();
      dispatch(stale, {
        type: "snapshot",
        job: snapshot("job-1", [bulkCode("RJ000001", "queued")]),
      });
      dispatch(stale, codeEvent("fetched"));
      dispatch(stale, { type: "finished", jobId: "job-1", reason: "complete" });
      expect(store.getState().job).toBeNull();
      expect(events).toEqual([]);
    });

    it("POST の応答を待つあいだは EventSource を開かない", async () => {
      const gate = deferred<{ jobId: string }>();
      const { store, sources } = createHarness({ startJob: vi.fn(() => gate.promise) });
      const bulk = store.startBulk(["RJ000001"]);
      const single = store.startSingle("RJ000002");
      await flush();
      expect(sources).toHaveLength(0);
      gate.resolve({ jobId: "job-1" });
      await Promise.all([bulk, single]);
      expect(sources.length).toBeGreaterThan(0);
    });

    it("ネイティブ error では status 照会を1回だけ行う", async () => {
      const { store, deps, last } = createHarness({
        getCurrent: vi.fn(async () => snapshot("job-1")),
      });
      await store.startBulk(["RJ000001"]);
      last().onerror?.(new Event("error"));
      await flush();
      expect(deps.getCurrent).toHaveBeenCalledTimes(1);
    });

    it("JSON として解析できないイベントでも接続を閉じ、error を立てて追跡を終える", async () => {
      const { store, events, last } = createHarness();
      await store.startBulk(["RJ000001"]);
      last().dispatchEvent(new MessageEvent("code", { data: "{not json" }));
      expect(last().closed).toBe(true);
      expect(store.getState().job).toBeNull();
      expect(store.getState().error).not.toBeNull();
      expect(events.map((event) => event.type)).toEqual(["finished"]);
    });

    it("409 root_reconfiguring: startSingle の POST は reset して error を立てない", async () => {
      const startJob = vi
        .fn()
        .mockResolvedValueOnce({ jobId: "job-1" })
        .mockRejectedValueOnce(new ApiRequestError(409, "root_reconfiguring", "再設定中です"));
      const { store, last } = createHarness({ startJob });
      await store.startBulk(["RJ000001"]);
      const source = last();
      const result = await store.startSingle("RJ000002");
      expect(result).toEqual({ ok: true });
      expect(store.getState().job).toBeNull();
      expect(store.getState().pendingSingles.size).toBe(0);
      expect(store.getState().error).toBeNull();
      expect(source.closed).toBe(true);
    });

    it("409 root_reconfiguring: attach の GET は reset して error を立てず、接続も開かない", async () => {
      const { store, sources } = createHarness({
        getCurrent: vi.fn(async () => {
          throw new ApiRequestError(409, "root_reconfiguring", "再設定中です");
        }),
      });
      await store.attach();
      expect(store.getState().job).toBeNull();
      expect(store.getState().error).toBeNull();
      expect(sources).toHaveLength(0);
    });
  });
});
