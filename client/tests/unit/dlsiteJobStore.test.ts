import { describe, expect, it, vi } from "vitest";
import {
  DLSITE_JOB_MAX_PRODUCT_CODES,
  type DlsiteJobCode,
  type DlsiteJobCodeState,
  type DlsiteJobEvent,
  type DlsiteJobSnapshot,
  type DlsiteJobState,
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

const TITLE = "タイトル";

function code(productCode: string, state: DlsiteJobCodeState, revision: number): DlsiteJobCode {
  const base = { productCode, revision };
  switch (state) {
    case "queued":
    case "fetching":
      return { ...base, state };
    case "fetched":
      return {
        ...base,
        state,
        dlsite: { state: "fetched", title: TITLE, cover: { state: "none" } },
      };
    case "not_found":
    case "failed":
      return { ...base, state, dlsite: { state } };
  }
}

function snapshot(
  jobId: string,
  codes: DlsiteJobCode[] = [],
  status: DlsiteJobSnapshot["status"] = "running",
): DlsiteJobSnapshot {
  return {
    jobId,
    status,
    codes,
    progress: {
      total: codes.length,
      processed: codes.filter((entry) => entry.state !== "queued" && entry.state !== "fetching")
        .length,
    },
  };
}

const serverState = (revision: number, job: DlsiteJobSnapshot | null): DlsiteJobState => ({
  revision,
  job,
});

function codeEvent(
  jobId: string,
  entry: DlsiteJobCode,
  progress = { processed: 0, total: 1 },
): DlsiteJobEvent {
  return { type: "code", jobId, progress, ...entry };
}

function createHarness(overrides: Partial<DlsiteJobDeps> = {}) {
  const sources: FakeEventSource[] = [];
  const deps: DlsiteJobDeps = {
    startJob: vi.fn(async () => serverState(1, snapshot("job-1", [code("RJ000001", "queued", 1)]))),
    getCurrent: vi.fn(async () => serverState(0, null)),
    cancel: vi.fn(async () => ({ removed: 0 })),
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
const codeState = (
  store: ReturnType<typeof createHarness>["store"],
  productCode: string,
): DlsiteJobCodeState | undefined => store.getState().job?.codes.get(productCode)?.state;

describe("dlsiteJobStore", () => {
  describe("開始", () => {
    it("応答待ちの間に start を2回呼んでも POST は1回", async () => {
      const gate = deferred<DlsiteJobState>();
      const { store, deps } = createHarness({ startJob: vi.fn(() => gate.promise) });
      const first = store.start(["RJ000001"], false);
      expect(store.getState().starting).toEqual({ total: 1 });
      await store.start(["RJ000001"], false);
      gate.resolve(serverState(1, snapshot("job-1")));
      await first;
      expect(deps.startJob).toHaveBeenCalledTimes(1);
    });

    it("上限ごとに分割して順に POST し、途中で失敗すると残りは送らず追跡は維持する", async () => {
      const startJob = vi
        .fn()
        .mockResolvedValueOnce(serverState(1, snapshot("job-1", [code("RJ100000", "queued", 1)])))
        .mockRejectedValueOnce(new ApiRequestError(500, "internal", "失敗しました"));
      const { store, last } = createHarness({ startJob });
      const result = await store.start(codesOf(2500), false);
      const sizes = startJob.mock.calls.map(
        ([body]) => (body as { productCodes: string[] }).productCodes.length,
      );
      expect(sizes).toEqual([DLSITE_JOB_MAX_PRODUCT_CODES, DLSITE_JOB_MAX_PRODUCT_CODES]);
      expect(result).toEqual({ ok: false, error: "失敗しました" });
      expect(store.getState().starting).toBeNull();
      expect(store.getState().job?.jobId).toBe("job-1");
      expect(last().closed).toBe(false);
    });

    it("2500件は 1000/1000/500 の3回に分かれる", async () => {
      const { store, deps } = createHarness();
      await store.start(codesOf(2500), false);
      expect(
        vi
          .mocked(deps.startJob)
          .mock.calls.map(([body]) => (body as { productCodes: string[] }).productCodes.length),
      ).toEqual([1000, 1000, 500]);
    });

    it("分割中にジョブが変わると、前のジョブの結果不明のコードと終わりを1回ずつ通知して新しいほうを追跡する", async () => {
      const startJob = vi
        .fn()
        .mockResolvedValueOnce(serverState(1, snapshot("job-1", [code("RJ000001", "queued", 1)])))
        .mockResolvedValueOnce(serverState(5, snapshot("job-2", [code("RJ000002", "queued", 5)])));
      const { store, events } = createHarness({ startJob });
      await store.start(codesOf(1500), false);
      expect(events).toEqual([
        { type: "codesSettled", codes: [{ code: "RJ000001", known: false }] },
        { type: "jobEnded", jobId: "job-1" },
      ]);
      expect(store.getState().job?.jobId).toBe("job-2");
    });

    it("starting は最後の分割POSTの応答を取り込んだ時点で外れる", async () => {
      const gate = deferred<DlsiteJobState>();
      const startJob = vi
        .fn()
        .mockResolvedValueOnce(serverState(1, snapshot("job-1")))
        .mockImplementationOnce(() => gate.promise);
      const { store } = createHarness({ startJob });
      const pending = store.start(codesOf(1500), false);
      await flush();
      expect(store.getState().starting).toEqual({ total: 1500 });
      expect(store.getState().job?.jobId).toBe("job-1");
      gate.resolve(serverState(2, snapshot("job-1")));
      await pending;
      expect(store.getState().starting).toBeNull();
    });

    it("offline は error を返すが state.error には入れない", async () => {
      const startJob = vi.fn(async () => {
        throw new ApiRequestError(503, "offline", "オフラインです");
      });
      const { store } = createHarness({ startJob });
      expect(await store.start(["RJ000001"], false)).toEqual({
        ok: false,
        error: "オフラインです",
      });
      expect(store.getState().error).toBeNull();
      expect(store.getState().starting).toBeNull();
    });
  });

  describe("応答待ち中の reset", () => {
    it("start は応答前に reset すると SSE を開かない", async () => {
      const gate = deferred<DlsiteJobState>();
      const { store, sources } = createHarness({ startJob: vi.fn(() => gate.promise) });
      const pending = store.start(["RJ000001"], false);
      store.reset();
      gate.resolve(serverState(1, snapshot("job-1")));
      await pending;
      expect(sources).toHaveLength(0);
      expect(store.getState().job).toBeNull();
    });

    it("attach は応答前に reset すると SSE を開かない", async () => {
      const gate = deferred<DlsiteJobState>();
      const { store, sources } = createHarness({ getCurrent: vi.fn(() => gate.promise) });
      const pending = store.attach();
      store.reset();
      gate.resolve(serverState(1, snapshot("job-1")));
      await pending;
      expect(sources).toHaveLength(0);
    });

    it("reset で接続を閉じ、状態を revision ごと空にする", async () => {
      const { store, last } = createHarness({
        getCurrent: vi.fn(async () => serverState(7, snapshot("job-1"))),
      });
      await store.attach();
      expect(store.getState().revision).toBe(7);
      store.reset();
      expect(last().closed).toBe(true);
      expect(store.getState().job).toBeNull();
      expect(store.getState().revision).toBe(0);
    });

    it("reset のあとに古い接続から届いたイベントは無視する", async () => {
      const { store, events, last } = createHarness();
      await store.start(["RJ000001"], false);
      const stale = last();
      store.reset();
      dispatch(stale, {
        type: "snapshot",
        revision: 50,
        job: snapshot("job-1", [code("RJ000001", "queued", 50)]),
      });
      dispatch(stale, codeEvent("job-1", code("RJ000001", "fetched", 51)));
      dispatch(stale, { type: "finished", revision: 52, jobId: "job-1", reason: "complete" });
      expect(store.getState().job).toBeNull();
      expect(events).toEqual([]);
    });

    it("reset の前に発行した応答は、revision が進んでいても取り込まない", async () => {
      const gate = deferred<DlsiteJobState>();
      const { store } = createHarness({ startJob: vi.fn(() => gate.promise) });
      const pending = store.start(["RJ000001"], false);
      store.reset();
      gate.resolve(serverState(99, snapshot("job-1")));
      await pending;
      expect(store.getState().revision).toBe(0);
    });
  });

  describe("attach", () => {
    it("実行中のジョブを取り込んで追跡し、2回目は接続を増やさない", async () => {
      const running = createHarness({
        getCurrent: vi.fn(async () => serverState(3, snapshot("job-1"))),
      });
      await running.store.attach();
      expect(running.sources).toHaveLength(1);
      await running.store.attach();
      expect(running.sources).toHaveLength(1);
    });

    it("最初の取り込みでは、前に終わったジョブの終端コードを通知しない（結果は results に取り込む）。ジョブが無ければ何もしない", async () => {
      const done = createHarness({
        getCurrent: vi.fn(async () =>
          serverState(9, snapshot("job-1", [code("RJ000001", "fetched", 8)], "finished")),
        ),
      });
      await done.store.attach();
      expect(done.sources).toHaveLength(0);
      expect(done.store.getState().job?.status).toBe("finished");
      expect(done.events).toEqual([]);
      expect(done.store.getState().results.get("RJ000001")?.revision).toBe(8);
      const none = createHarness({ getCurrent: vi.fn(async () => serverState(4, null)) });
      await none.store.attach();
      expect(none.sources).toHaveLength(0);
      expect(none.events).toEqual([]);
    });
  });

  describe("サーバー状態の取り込み", () => {
    it("revision が進まない状態は捨てる", async () => {
      const { store, last } = createHarness();
      await store.start(["RJ000001"], false);
      dispatch(last(), {
        type: "snapshot",
        revision: 10,
        job: snapshot("job-1", [code("RJ000001", "fetching", 10)]),
      });
      dispatch(last(), {
        type: "snapshot",
        revision: 10,
        job: snapshot("job-1", [code("RJ000001", "queued", 10)]),
      });
      dispatch(last(), {
        type: "snapshot",
        revision: 4,
        job: snapshot("job-1", [code("RJ000001", "queued", 4)]),
      });
      expect(codeState(store, "RJ000001")).toBe("fetching");
      expect(store.getState().revision).toBe(10);
    });

    it("捨てたスナップショットでは空の再接続の回数を戻さず、捨て続けると追跡をあきらめる", async () => {
      const { store, last } = createHarness({
        getCurrent: vi.fn(async () => serverState(2, snapshot("job-1"))),
      });
      await store.start(["RJ000001"], false);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        dispatch(last(), { type: "snapshot", revision: 0, job: null });
        last().readyState = 2;
        last().onerror?.(new Event("error"));
        await flush();
      }
      expect(store.getState().error).not.toBeNull();
      expect(store.getState().job).toBeNull();
    });

    it("古い null は新しいジョブを消さない", async () => {
      const { store, last } = createHarness();
      await store.start(["RJ000001"], false);
      dispatch(last(), { type: "snapshot", revision: 0, job: null });
      expect(store.getState().job?.jobId).toBe("job-1");
    });

    it("code イベントで行の状態と progress を更新し、終端状態なら codesSettled を出す", async () => {
      const { store, events, last } = createHarness();
      await store.start(["RJ000001"], false);
      dispatch(last(), codeEvent("job-1", code("RJ000001", "fetching", 2)));
      expect(events).toEqual([]);
      dispatch(
        last(),
        codeEvent("job-1", code("RJ000001", "fetched", 3), { processed: 1, total: 1 }),
      );
      expect(codeState(store, "RJ000001")).toBe("fetched");
      expect(store.getState().job?.progress).toEqual({ processed: 1, total: 1 });
      expect(events).toEqual([
        { type: "codesSettled", codes: [{ code: "RJ000001", known: true }] },
      ]);
    });

    it("終端の結果は results に revision つきで残り、より新しい結果だけが置き換える", async () => {
      const { store, last } = createHarness();
      await store.start(["RJ000001"], false);
      dispatch(last(), codeEvent("job-1", code("RJ000001", "failed", 5)));
      expect(store.getState().results.get("RJ000001")).toEqual({
        dlsite: { state: "failed" },
        revision: 5,
      });
      dispatch(last(), codeEvent("job-1", code("RJ000001", "fetching", 6)));
      expect(store.getState().results.get("RJ000001")?.revision).toBe(5);
      dispatch(last(), codeEvent("job-1", code("RJ000001", "fetched", 7)));
      expect(store.getState().results.get("RJ000001")).toEqual({
        dlsite: { state: "fetched", title: TITLE, cover: { state: "none" } },
        revision: 7,
      });
    });

    it("ジョブが入れ替わっても、前のジョブで終端したコードの結果は残る", async () => {
      const startJob = vi
        .fn()
        .mockResolvedValueOnce(serverState(1, snapshot("job-1", [code("RJ000001", "queued", 1)])))
        .mockResolvedValueOnce(
          serverState(40, snapshot("job-2", [code("RJ000002", "fetching", 40)])),
        );
      const { store, last } = createHarness({ startJob });
      await store.start(["RJ000001"], false);
      dispatch(last(), codeEvent("job-1", code("RJ000001", "fetched", 30)));
      dispatch(last(), { type: "finished", revision: 31, jobId: "job-1", reason: "complete" });
      await store.start(["RJ000002"], false);
      expect(store.getState().job?.jobId).toBe("job-2");
      expect(store.getState().results.get("RJ000001")?.revision).toBe(30);
    });

    it("removed で codes と progress が更新される", async () => {
      const { store, last } = createHarness({
        startJob: vi.fn(async () =>
          serverState(
            1,
            snapshot("job-1", [code("RJ000001", "fetching", 1), code("RJ000002", "queued", 1)]),
          ),
        ),
      });
      await store.start(["RJ000001", "RJ000002"], false);
      dispatch(last(), {
        type: "removed",
        revision: 2,
        jobId: "job-1",
        productCodes: ["RJ000002"],
        progress: { processed: 0, total: 1 },
      });
      expect([...store.getState().job!.codes.keys()]).toEqual(["RJ000001"]);
      expect(store.getState().job?.progress).toEqual({ processed: 0, total: 1 });
    });
  });

  describe("終端", () => {
    it("finished を2回・snapshot(finished)＋finished でも jobEnded は1回で、接続を閉じる", async () => {
      const { store, events, last } = createHarness();
      await store.start(["RJ000001"], false);
      const source = last();
      dispatch(source, {
        type: "snapshot",
        revision: 5,
        job: snapshot("job-1", [code("RJ000001", "fetched", 4)], "finished"),
      });
      dispatch(source, { type: "finished", revision: 6, jobId: "job-1", reason: "complete" });
      dispatch(source, { type: "finished", revision: 6, jobId: "job-1", reason: "complete" });
      expect(events.filter((event) => event.type === "jobEnded")).toEqual([
        { type: "jobEnded", jobId: "job-1" },
      ]);
      expect(source.closed).toBe(true);
      expect(store.getState().job?.status).toBe("finished");
    });

    it("finished で未終端のまま残ったコードは結果不明にしない", async () => {
      const { store, events, last } = createHarness({
        startJob: vi.fn(async () =>
          serverState(
            1,
            snapshot("job-1", [code("RJ000001", "fetched", 1), code("RJ000002", "queued", 1)]),
          ),
        ),
      });
      await store.start(["RJ000001", "RJ000002"], false);
      events.length = 0;
      dispatch(last(), { type: "finished", revision: 2, jobId: "job-1", reason: "aborted" });
      expect(events).toEqual([{ type: "jobEnded", jobId: "job-1" }]);
    });

    it("不正なイベントで接続を閉じ、job を null にして error を立て、終わりを通知する", async () => {
      const { store, events, last } = createHarness();
      await store.start(["RJ000001"], false);
      last().dispatchEvent(new MessageEvent("code", { data: JSON.stringify({ type: "code" }) }));
      expect(last().closed).toBe(true);
      expect(store.getState().job).toBeNull();
      expect(store.getState().error).not.toBeNull();
      expect(events).toEqual([
        { type: "codesSettled", codes: [{ code: "RJ000001", known: false }] },
        { type: "jobEnded", jobId: "job-1" },
      ]);
      store.clearError();
      expect(store.getState().error).toBeNull();
    });

    it("JSON として解析できないイベントでも接続を閉じ、error を立てて追跡を終える", async () => {
      const { store, events, last } = createHarness();
      await store.start(["RJ000001"], false);
      last().dispatchEvent(new MessageEvent("code", { data: "{not json" }));
      expect(last().closed).toBe(true);
      expect(store.getState().job).toBeNull();
      expect(store.getState().error).not.toBeNull();
      expect(events.map((event) => event.type)).toEqual(["codesSettled", "jobEnded"]);
    });
  });

  describe("切断からの復旧", () => {
    it("エラー時に照会して、同じジョブが running で接続が CONNECTING なら追跡を維持する", async () => {
      const { store, sources, last } = createHarness({
        getCurrent: vi.fn(async () =>
          serverState(6, snapshot("job-1", [code("RJ000001", "fetched", 6)])),
        ),
      });
      await store.start(["RJ000001"], false);
      last().onerror?.(new Event("error"));
      await flush();
      expect(sources).toHaveLength(1);
      expect(codeState(store, "RJ000001")).toBe("fetched");
    });

    it("接続が CLOSED なら張り直す", async () => {
      const { store, sources, last } = createHarness({
        getCurrent: vi.fn(async () => serverState(2, snapshot("job-1"))),
      });
      await store.start(["RJ000001"], false);
      last().readyState = 2;
      last().onerror?.(new Event("error"));
      await flush();
      expect(sources).toHaveLength(2);
      expect(store.getState().job?.jobId).toBe("job-1");
    });

    it("照会が null なら、ミラーのジョブは終わりを見ないまま消えた扱いにする", async () => {
      const { store, events, last } = createHarness({
        getCurrent: vi.fn(async () => serverState(8, null)),
      });
      await store.start(["RJ000001"], false);
      events.length = 0;
      last().onerror?.(new Event("error"));
      await flush();
      expect(events).toEqual([
        { type: "codesSettled", codes: [{ code: "RJ000001", known: false }] },
        { type: "jobEnded", jobId: "job-1" },
      ]);
      expect(store.getState().job).toBeNull();
    });

    it("別のジョブが running なら、前のジョブの結果不明のコードを通知して乗り換える", async () => {
      const { store, events, sources, last } = createHarness({
        getCurrent: vi.fn(async () => serverState(9, snapshot("job-2"))),
      });
      await store.start(["RJ000001"], false);
      events.length = 0;
      last().onerror?.(new Event("error"));
      await flush();
      expect(events.filter((event) => event.type === "jobEnded")).toHaveLength(1);
      expect(sources).toHaveLength(2);
      expect(store.getState().job?.jobId).toBe("job-2");
    });

    it("ジョブAの取得中に切断してジョブBで再接続すると、Aの終端でないコードだけが結果不明になる", async () => {
      const { store, events, last } = createHarness({
        getCurrent: vi.fn(async () =>
          serverState(60, snapshot("job-b", [code("RJ000009", "fetching", 60)])),
        ),
        startJob: vi.fn(async () =>
          serverState(
            40,
            snapshot("job-a", [
              code("RJ000001", "fetching", 40),
              code("RJ000002", "queued", 40),
              code("RJ000003", "fetched", 38),
            ]),
          ),
        ),
      });
      await store.start(["RJ000001"], false);
      events.length = 0;
      last().onerror?.(new Event("error"));
      await flush();
      expect(events).toEqual([
        {
          type: "codesSettled",
          codes: [
            { code: "RJ000001", known: false },
            { code: "RJ000002", known: false },
          ],
        },
        { type: "jobEnded", jobId: "job-a" },
      ]);
      expect(store.getState().job?.jobId).toBe("job-b");
    });

    it("発行した照会より新しいスナップショットを先に受けたら、遅れて返った照会でジョブを巻き戻さない", async () => {
      const gate = deferred<DlsiteJobState>();
      const { store, sources, last } = createHarness({
        getCurrent: vi.fn(() => gate.promise),
        startJob: vi.fn(async () => serverState(40, snapshot("job-a"))),
      });
      await store.start(["RJ000001"], false);
      last().onerror?.(new Event("error"));
      dispatch(last(), {
        type: "snapshot",
        revision: 60,
        job: snapshot("job-b", [code("RJ000009", "fetching", 60)]),
      });
      gate.resolve(serverState(40, snapshot("job-a")));
      await flush();
      expect(store.getState().job?.jobId).toBe("job-b");
      expect(sources.length).toBe(2);
    });

    it("追跡外 jobId の code イベントで照会して確定する（null なら消えた扱い）", async () => {
      const { store, events, last } = createHarness({
        getCurrent: vi.fn(async () => serverState(9, null)),
      });
      await store.start(["RJ000001"], false);
      events.length = 0;
      dispatch(last(), codeEvent("other", code("RJ000001", "fetched", 8)));
      await flush();
      expect(events.map((event) => event.type)).toEqual(["codesSettled", "jobEnded"]);
    });

    it("何も受け取らないまま CLOSED が3回続くと error を立てて追跡を終える", async () => {
      const { store, sources, last } = createHarness({
        getCurrent: vi.fn(async () => serverState(2, snapshot("job-1"))),
      });
      await store.start(["RJ000001"], false);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        last().readyState = 2;
        last().onerror?.(new Event("error"));
        await flush();
      }
      expect(sources).toHaveLength(3);
      expect(store.getState().error).not.toBeNull();
      expect(store.getState().job).toBeNull();
    });

    it("照会の失敗では追跡を保つ", async () => {
      const { store, last } = createHarness({
        getCurrent: vi.fn(async () => {
          throw new Error("network");
        }),
      });
      await store.start(["RJ000001"], false);
      last().onerror?.(new Event("error"));
      await flush();
      expect(store.getState().job?.jobId).toBe("job-1");
      expect(store.getState().error).toBeNull();
    });

    it("ネイティブ error では照会を1回だけ行う", async () => {
      const { store, deps, last } = createHarness({
        getCurrent: vi.fn(async () => serverState(2, snapshot("job-1"))),
      });
      await store.start(["RJ000001"], false);
      last().onerror?.(new Event("error"));
      await flush();
      expect(deps.getCurrent).toHaveBeenCalledTimes(1);
    });

    it("再接続のスナップショットで取り直しの終端を知ると、状態が同じでも終端に達したコードとして通知する", async () => {
      const { store, events, last } = createHarness({
        startJob: vi.fn(async () =>
          serverState(30, snapshot("job-1", [code("RJ000001", "fetched", 30)])),
        ),
      });
      await store.start(["RJ000001"], false);
      events.length = 0;
      dispatch(last(), {
        type: "snapshot",
        revision: 42,
        job: snapshot("job-1", [code("RJ000001", "fetched", 42)]),
      });
      expect(events).toEqual([
        { type: "codesSettled", codes: [{ code: "RJ000001", known: true }] },
      ]);
      expect(store.getState().results.get("RJ000001")?.revision).toBe(42);
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
      await post.store.start(["RJ000001"], false);
      expect(post.store.getState().error).toBeNull();
      expect(post.store.getState().starting).toBeNull();

      const get = createHarness({
        getCurrent: vi.fn(async () => {
          throw rootReconfiguring();
        }),
      });
      await get.store.start(["RJ000001"], false);
      get.last().onerror?.(new Event("error"));
      await flush();
      expect(get.store.getState().job).toBeNull();
      expect(get.store.getState().error).toBeNull();
      expect(get.last().closed).toBe(true);

      const del = createHarness({
        cancel: vi.fn(async () => {
          throw rootReconfiguring();
        }),
        startJob: vi.fn(async () =>
          serverState(1, snapshot("job-1", [code("RJ000001", "queued", 1)])),
        ),
      });
      await del.store.start(["RJ000001"], false);
      await del.store.cancel();
      expect(del.store.getState().job).toBeNull();
      expect(del.store.getState().error).toBeNull();
    });

    it("2回目の start の POST は reset して error を立てない", async () => {
      const startJob = vi
        .fn()
        .mockResolvedValueOnce(serverState(1, snapshot("job-1", [code("RJ000001", "queued", 1)])))
        .mockRejectedValueOnce(new ApiRequestError(409, "root_reconfiguring", "再設定中です"));
      const { store, last } = createHarness({ startJob });
      await store.start(["RJ000001"], false);
      const source = last();
      const result = await store.start(["RJ000002"], false);
      expect(result).toEqual({ ok: true });
      expect(store.getState().job).toBeNull();
      expect(store.getState().error).toBeNull();
      expect(source.closed).toBe(true);
    });

    it("attach の GET は reset して error を立てず、接続も開かない", async () => {
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

  describe("ジョブの乗り換え", () => {
    it("2回目の start の応答が SSE の終端より遅れて届いても、ジョブを巻き戻さない", async () => {
      const gate = deferred<DlsiteJobState>();
      const startJob = vi
        .fn()
        .mockResolvedValueOnce(serverState(1, snapshot("job-1", [code("RJ000001", "queued", 1)])))
        .mockImplementationOnce(() => gate.promise);
      const { store, last } = createHarness({ startJob });
      await store.start(["RJ000001"], false);
      const pending = store.start(["RJ000001"], true);
      await flush();
      dispatch(last(), codeEvent("job-1", code("RJ000001", "queued", 21)));
      dispatch(last(), codeEvent("job-1", code("RJ000001", "fetching", 22)));
      dispatch(
        last(),
        codeEvent("job-1", code("RJ000001", "fetched", 23), { processed: 1, total: 1 }),
      );
      dispatch(last(), { type: "finished", revision: 24, jobId: "job-1", reason: "complete" });
      gate.resolve(serverState(21, snapshot("job-1", [code("RJ000001", "queued", 21)])));
      await pending;
      expect(codeState(store, "RJ000001")).toBe("fetched");
      expect(store.getState().job?.status).toBe("finished");
      expect(store.getState().revision).toBe(24);
    });

    it("応答で別のジョブに乗り換えたら、前のジョブの結果不明のコードを通知する", async () => {
      const { store, events } = createHarness({
        startJob: vi
          .fn()
          .mockResolvedValueOnce(serverState(1, snapshot("job-1", [code("RJ000001", "queued", 1)])))
          .mockResolvedValueOnce(
            serverState(9, snapshot("job-2", [code("RJ000002", "queued", 9)])),
          ),
      });
      await store.start(["RJ000001"], false);
      events.length = 0;
      await store.start(["RJ000002"], false);
      expect(events[0]).toEqual({
        type: "codesSettled",
        codes: [{ code: "RJ000001", known: false }],
      });
    });
  });

  describe("中止", () => {
    it("queued のコードが無ければ DELETE を送らない", async () => {
      const { store, deps } = createHarness({
        startJob: vi.fn(async () =>
          serverState(
            1,
            snapshot("job-1", [code("RJ000001", "fetching", 1), code("RJ000002", "fetched", 1)]),
          ),
        ),
      });
      await store.start(["RJ000001"], false);
      await store.cancel();
      expect(deps.cancel).not.toHaveBeenCalled();
    });

    it("DELETE を送り、cancelling は応答で戻る", async () => {
      const { store, deps } = createHarness({
        startJob: vi.fn(async () =>
          serverState(
            1,
            snapshot("job-1", [code("RJ000001", "fetching", 1), code("RJ000002", "queued", 1)]),
          ),
        ),
      });
      await store.start(["RJ000001", "RJ000002"], false);
      await store.cancel();
      expect(deps.cancel).toHaveBeenCalledWith("job-1");
      expect(store.getState().cancelling).toBe(false);
    });
  });
});
