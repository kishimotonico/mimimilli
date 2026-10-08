import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DlsiteBulkSnapshot } from "@mimimilli/shared";
import { ApiRequestError } from "../../src/shared/api/http";
import {
  createDlsiteBulkStore,
  type DlsiteBulkDeps,
  type DlsiteBulkEvent,
} from "../../src/entities/dlsite/model/dlsiteBulkStore";

class FakeEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState = FakeEventSource.OPEN;
  close(): void {
    this.readyState = FakeEventSource.CLOSED;
  }

  get closed(): boolean {
    return this.readyState === FakeEventSource.CLOSED;
  }
}

const result = { fetched: 2, failed: 0, parseErrors: 0, skipped: 0 };

function createHarness(overrides: Partial<DlsiteBulkDeps> = {}) {
  const sources: FakeEventSource[] = [];
  const urls: string[] = [];
  const deps: DlsiteBulkDeps = {
    startBulk: vi.fn(async () => "job-1"),
    getStatus: vi.fn(
      async (): Promise<DlsiteBulkSnapshot> => ({ current: null, lastTerminal: null }),
    ),
    cancelBulk: vi.fn(async () => {}),
    connect: (url) => {
      const source = new FakeEventSource();
      sources.push(source);
      urls.push(url);
      return { source: source as unknown as EventSource, close: () => source.close() };
    },
    ...overrides,
  };
  const store = createDlsiteBulkStore(deps);
  const events: DlsiteBulkEvent[] = [];
  store.subscribeEvents((event) => events.push(event));
  return { store, deps, sources, urls, events };
}

function dispatch(source: FakeEventSource, type: string, payload: unknown): void {
  source.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(payload) }));
}

function connectionError(source: FakeEventSource, readyState = FakeEventSource.CONNECTING): void {
  source.readyState = readyState;
  source.dispatchEvent(new Event("error"));
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dlsiteBulkStore", () => {
  it("開始はPOSTの応答後に追跡を始め、応答待ちの間の多重開始はPOSTを増やさない", async () => {
    let resolvePost!: (jobId: string) => void;
    const startBulk = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolvePost = resolve;
        }),
    );
    const { store, sources, urls } = createHarness({ startBulk });

    const first = store.start();
    const second = store.start();
    expect(store.getState()).toMatchObject({ starting: true, jobId: null });
    expect(sources).toHaveLength(0);

    resolvePost("job-1");
    await Promise.all([first, second]);
    expect(startBulk).toHaveBeenCalledTimes(1);
    expect(store.getState()).toMatchObject({ starting: false, jobId: "job-1" });
    expect(urls).toEqual(["/api/dlsite/events"]);
  });

  it("開始の失敗はerrorを通知して追跡しない。root再設定中の409は通知しない", async () => {
    const startBulk = vi.fn<DlsiteBulkDeps["startBulk"]>();
    startBulk.mockRejectedValueOnce(new Error("開始できません"));
    startBulk.mockRejectedValueOnce(new ApiRequestError(409, "root_reconfiguring", "再設定中"));
    const { store, sources, events } = createHarness({ startBulk });

    await store.start();
    expect(events).toEqual([{ type: "error", message: "開始できません" }]);
    expect(store.getState()).toEqual({
      jobId: null,
      starting: false,
      cancelling: false,
      progress: null,
    });

    await store.start();
    expect(events).toHaveLength(1);
    expect(sources).toHaveLength(0);
  });

  it("progressとcancellingのイベントを状態へ反映する", async () => {
    const { store, sources } = createHarness();
    await store.start();
    const work = { id: "work-1", rjCode: "RJ111111", title: "作品1" };
    dispatch(sources[0]!, "progress", {
      type: "progress",
      jobId: "job-1",
      processed: 1,
      total: 5,
      work,
    });
    expect(store.getState().progress).toEqual({ processed: 1, total: 5, work });

    dispatch(sources[0]!, "cancelling", { type: "cancelling", jobId: "job-1" });
    expect(store.getState().cancelling).toBe(true);
  });

  it("completeイベントを受けたら状態を確認し、終端を一度だけ通知して接続を閉じる", async () => {
    const getStatus = vi.fn(
      async (): Promise<DlsiteBulkSnapshot> => ({
        current: null,
        lastTerminal: { jobId: "job-1", status: "complete", result },
      }),
    );
    const { store, sources, events } = createHarness({ getStatus });
    await store.start();

    dispatch(sources[0]!, "complete", { type: "complete", jobId: "job-1", result });
    dispatch(sources[0]!, "complete", { type: "complete", jobId: "job-1", result });
    await flush();

    expect(events).toEqual([
      { type: "terminal", terminal: { jobId: "job-1", status: "complete", result } },
    ]);
    expect(store.getState()).toMatchObject({ jobId: null, cancelling: false, progress: null });
    expect(sources[0]!.closed).toBe(true);
  });

  it("取消の要求は追跡中のジョブがあるときだけ送り、失敗はerrorで通知する", async () => {
    const cancelBulk = vi.fn<DlsiteBulkDeps["cancelBulk"]>(async () => {});
    const { store, events } = createHarness({ cancelBulk });
    await store.cancel();
    expect(cancelBulk).not.toHaveBeenCalled();

    await store.start();
    await store.cancel();
    expect(cancelBulk).toHaveBeenCalledTimes(1);

    cancelBulk.mockRejectedValueOnce(new Error("中止できません"));
    await store.cancel();
    expect(events).toEqual([{ type: "error", message: "中止できません" }]);
  });

  it("attachは実行中のジョブを追跡し、取消中や進捗も状態へ反映する", async () => {
    const progress = { processed: 2, total: 5, work: null };
    const { store, sources } = createHarness({
      getStatus: vi.fn(
        async (): Promise<DlsiteBulkSnapshot> => ({
          current: { jobId: "job-1", status: "cancelling", progress },
          lastTerminal: null,
        }),
      ),
    });
    await store.attach();
    expect(store.getState()).toMatchObject({ jobId: "job-1", cancelling: true, progress });
    expect(sources).toHaveLength(1);

    await store.attach();
    expect(sources).toHaveLength(1);
  });

  it("attachで実行中のジョブが無く終端済みならその結果を通知し、何も無ければ何もしない", async () => {
    const getStatus = vi.fn<DlsiteBulkDeps["getStatus"]>();
    const { store, sources, events } = createHarness({ getStatus });
    getStatus.mockResolvedValueOnce({ current: null, lastTerminal: null });
    await store.attach();
    expect(events).toEqual([]);

    const terminal = { jobId: "job-1", status: "cancelled" as const, result };
    getStatus.mockResolvedValueOnce({ current: null, lastTerminal: terminal });
    await store.attach();
    expect(events).toEqual([{ type: "terminal", terminal }]);
    expect(store.getState().jobId).toBeNull();

    getStatus.mockRejectedValueOnce(new Error("offline"));
    await store.attach();
    expect(events).toHaveLength(1);
    expect(sources).toHaveLength(0);
  });

  it("切断中に追跡中のジョブが終わり次のジョブへ進んでいたら、通知せずsupersededを出して乗り換える", async () => {
    const { store, sources, events } = createHarness({
      getStatus: vi.fn(
        async (): Promise<DlsiteBulkSnapshot> => ({
          current: {
            jobId: "job-3",
            status: "running",
            progress: { processed: 1, total: 4, work: null },
          },
          lastTerminal: { jobId: "job-2", status: "complete", result },
        }),
      ),
    });
    await store.start();
    connectionError(sources[0]!);
    await flush();

    expect(events).toEqual([{ type: "superseded" }]);
    expect(store.getState()).toMatchObject({
      jobId: "job-3",
      progress: { processed: 1, total: 4, work: null },
    });
    expect(sources[0]!.closed).toBe(true);
    expect(sources).toHaveLength(2);
  });

  it("追跡中でないjobIdのイベントを受けたらGETで確定し、追跡中ジョブの終端を反映する", async () => {
    const getStatus = vi.fn(
      async (): Promise<DlsiteBulkSnapshot> => ({
        current: { jobId: "job-2", status: "running", progress: null },
        lastTerminal: { jobId: "job-1", status: "complete", result },
      }),
    );
    const { store, sources, events } = createHarness({ getStatus });
    await store.start();
    dispatch(sources[0]!, "progress", {
      type: "progress",
      jobId: "job-2",
      processed: 1,
      total: 3,
      work: null,
    });
    await flush();

    expect(events).toEqual([
      { type: "terminal", terminal: { jobId: "job-1", status: "complete", result } },
    ]);
    expect(store.getState().jobId).toBeNull();
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it("確定GETがroot再設定中の409なら、通知せずに追跡を終えて進捗を片付ける", async () => {
    const { store, sources, events } = createHarness({
      getStatus: vi.fn(async () => {
        throw new ApiRequestError(409, "root_reconfiguring", "再設定中");
      }),
    });
    await store.start();
    dispatch(sources[0]!, "progress", {
      type: "progress",
      jobId: "job-1",
      processed: 1,
      total: 5,
      work: null,
    });
    connectionError(sources[0]!);
    await flush();

    expect(events).toEqual([]);
    expect(store.getState()).toMatchObject({ jobId: null, progress: null, cancelling: false });
    expect(sources[0]!.closed).toBe(true);
  });

  it("接続がCLOSEDでジョブが見つからなければ、errorを通知して追跡を終える", async () => {
    const { store, sources, events } = createHarness();
    await store.start();
    connectionError(sources[0]!, FakeEventSource.CLOSED);
    await flush();

    expect(events).toEqual([
      { type: "superseded" },
      { type: "error", message: "DLsite一括取得の接続が切断されました" },
    ]);
    expect(store.getState().jobId).toBeNull();
  });

  it("切断が一時的でジョブが実行中なら追跡を維持する", async () => {
    const getStatus = vi.fn(
      async (): Promise<DlsiteBulkSnapshot> => ({
        current: {
          jobId: "job-1",
          status: "running",
          progress: { processed: 1, total: 5, work: null },
        },
        lastTerminal: null,
      }),
    );
    const { store, sources, events } = createHarness({ getStatus });
    await store.start();
    connectionError(sources[0]!);
    await flush();

    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(events).toEqual([]);
    expect(store.getState()).toMatchObject({
      jobId: "job-1",
      progress: { processed: 1, total: 5 },
    });
  });

  it("接続がCLOSEDで実行中の状態を確認しても、errorを通知して追跡を終える", async () => {
    const { store, sources, events } = createHarness({
      getStatus: vi.fn(
        async (): Promise<DlsiteBulkSnapshot> => ({
          current: { jobId: "job-1", status: "running", progress: null },
          lastTerminal: null,
        }),
      ),
    });
    await store.start();
    connectionError(sources[0]!, FakeEventSource.CLOSED);
    await flush();

    expect(events).toEqual([{ type: "error", message: "DLsite一括取得の接続が切断されました" }]);
    expect(store.getState().jobId).toBeNull();
  });

  it("形式が不正なイベントでは追跡が固着せず、errorを通知する", async () => {
    const { store, sources, events } = createHarness();
    await store.start();
    dispatch(sources[0]!, "complete", { type: "complete", jobId: "job-1", result: "invalid" });

    expect(events).toEqual([{ type: "error", message: "DLsite進捗イベントの形式が不正です" }]);
    expect(store.getState().jobId).toBeNull();
    expect(sources[0]!.closed).toBe(true);
  });

  it("resetは接続を閉じて追跡状態を空にし、以後の古いイベントを無視する", async () => {
    const { store, sources, events } = createHarness();
    await store.start();
    dispatch(sources[0]!, "cancelling", { type: "cancelling", jobId: "job-1" });
    store.reset();

    expect(store.getState()).toEqual({
      jobId: null,
      starting: false,
      cancelling: false,
      progress: null,
    });
    expect(sources[0]!.closed).toBe(true);

    dispatch(sources[0]!, "progress", {
      type: "progress",
      jobId: "job-1",
      processed: 3,
      total: 5,
      work: null,
    });
    expect(store.getState().progress).toBeNull();
    expect(events).toEqual([]);
  });

  it("attachの応答待ち中にresetされたら、応答が返ってもSSEを開かない", async () => {
    let resolveStatus!: (snapshot: DlsiteBulkSnapshot) => void;
    const getStatus = vi.fn(
      () =>
        new Promise<DlsiteBulkSnapshot>((resolve) => {
          resolveStatus = resolve;
        }),
    );
    const { store, sources } = createHarness({ getStatus });
    const attached = store.attach();
    store.reset();
    resolveStatus({
      current: { jobId: "job-1", status: "running", progress: null },
      lastTerminal: null,
    });
    await attached;

    expect(sources).toHaveLength(0);
    expect(store.getState().jobId).toBeNull();
  });

  it("startの応答待ち中にresetされたら、応答が返ってもSSEを開かない", async () => {
    let resolvePost!: (jobId: string) => void;
    const startBulk = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolvePost = resolve;
        }),
    );
    const { store, sources } = createHarness({ startBulk });
    const started = store.start();
    store.reset();
    resolvePost("job-1");
    await started;

    expect(sources).toHaveLength(0);
    expect(store.getState()).toMatchObject({ jobId: null, starting: false });
  });
});
