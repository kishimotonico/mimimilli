import { describe, expect, it, vi } from "vitest";
import type { ScanJobEvent as SseScanJobEvent, ScanJobSnapshot } from "@mimimilli/shared";
import { ApiRequestError } from "../../src/shared/api/http";
import { ScanAlreadyActiveError } from "../../src/entities/scan/api";
import {
  createScanJobStore,
  isScanning,
  type ScanJobDeps,
  type ScanJobEvent,
} from "../../src/entities/scan/model/scanJobStore";

class FakeEventSource extends EventTarget {
  closed = false;
  onerror: ((event: Event) => void) | null = null;
  close(): void {
    this.closed = true;
  }
}

const running: ScanJobSnapshot = {
  id: "job-1",
  status: "running",
  createdAt: "2026-01-01T00:00:00.000Z",
  startedAt: "2026-01-01T00:00:00.001Z",
  finishedAt: null,
  progress: null,
  result: null,
  error: null,
};
const result = {
  registered: 1,
  insertedWorkIds: [],
  updatedWorkIds: [],
  errors: 0,
  missing: 0,
  skipped: 0,
  coverErrors: 0,
};
const completed: ScanJobSnapshot = {
  ...running,
  status: "completed",
  finishedAt: "2026-01-01T00:00:01.000Z",
  result,
};
const jobB: ScanJobSnapshot = { ...running, id: "job-2" };

function createHarness(overrides: Partial<ScanJobDeps> = {}) {
  const sources: FakeEventSource[] = [];
  const urls: string[] = [];
  const deps: ScanJobDeps = {
    startScan: vi.fn(async () => running),
    getActiveScan: vi.fn(async () => null),
    getScanJob: vi.fn(async () => completed),
    cancelScan: vi.fn(async () => ({ ...running, status: "cancelling" as const })),
    connect: (url) => {
      const source = new FakeEventSource();
      sources.push(source);
      urls.push(url);
      return { source: source as unknown as EventSource, close: () => source.close() };
    },
    ...overrides,
  };
  const store = createScanJobStore(deps);
  const events: ScanJobEvent[] = [];
  store.subscribeEvents((event) => events.push(event));
  return { store, deps, sources, urls, events };
}

function dispatch(source: FakeEventSource, event: SseScanJobEvent): void {
  source.dispatchEvent(new MessageEvent(event.type, { data: JSON.stringify(event) }));
}

function connectionError(source: FakeEventSource): void {
  source.onerror?.(new Event("error"));
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("scanJobStore", () => {
  it("attachでactiveジョブへ再接続し、state/progress/terminalを反映してterminalは一度だけ通知する", async () => {
    const { store, sources, urls, events } = createHarness({
      getActiveScan: vi.fn(async () => running),
    });
    await store.attach();
    expect(urls).toEqual(["/api/scan/job-1/events"]);
    const source = sources[0]!;

    dispatch(source, {
      type: "state",
      snapshot: { ...running, progress: { phase: "walking", processed: 10, total: 0 } },
    });
    expect(store.getState().job?.progress?.processed).toBe(10);
    dispatch(source, {
      type: "progress",
      progress: { phase: "registering", processed: 2, total: 5 },
    });
    expect(store.getState().job?.progress?.processed).toBe(2);
    dispatch(source, { type: "state", snapshot: { ...running, status: "cancelling" } });
    expect(store.getState().job?.status).toBe("cancelling");

    dispatch(source, { type: "completed", result });
    await flush();
    dispatch(source, { type: "completed", result });
    await flush();
    expect(events.filter((event) => event.type === "terminal")).toHaveLength(1);
    expect(store.getState().job?.status).toBe("completed");
    expect(isScanning(store.getState())).toBe(false);
    expect(source.closed).toBe(true);
  });

  it("追跡中のジョブがあればattachは何もしない", async () => {
    const { store, deps, sources } = createHarness({ getActiveScan: vi.fn(async () => running) });
    await store.start();
    await store.attach();
    expect(deps.getActiveScan).toHaveBeenCalledTimes(1);
    expect(sources).toHaveLength(1);
  });

  it("開始成功でstartedを通知して追跡を始め、取消の応答のcancellingを反映する", async () => {
    const { store, deps, sources, events } = createHarness();
    const started = await store.start({ full: true });
    expect(started).toEqual({ ok: true, job: running });
    expect(deps.startScan).toHaveBeenCalledWith({ full: true });
    expect(events).toEqual([{ type: "started", job: running }]);
    expect(sources).toHaveLength(1);

    const cancelled = await store.cancel();
    expect(cancelled).toMatchObject({ ok: true });
    expect(store.getState().job?.status).toBe("cancelling");
    expect(isScanning(store.getState())).toBe(true);
  });

  it("開始が409ならstartedを通知せず、実行中のジョブへ接続する", async () => {
    const { store, sources, events } = createHarness({
      startScan: vi.fn(async () => {
        throw new ScanAlreadyActiveError(running);
      }),
    });
    const outcome = await store.start();
    expect(outcome).toEqual({ ok: true, job: running });
    expect(events).toEqual([]);
    expect(sources).toHaveLength(1);
    expect(store.getState().job?.id).toBe("job-1");
  });

  it("追跡中のジョブが無ければcancelは何もしない", async () => {
    const { store, deps } = createHarness();
    expect(await store.cancel()).toEqual({ ok: true, job: null });
    expect(deps.cancelScan).not.toHaveBeenCalled();
  });

  it("接続エラー時のGETでterminalを補完して接続を閉じる", async () => {
    const { store, sources, events } = createHarness({ getActiveScan: vi.fn(async () => running) });
    await store.attach();
    connectionError(sources[0]!);
    await flush();
    expect(events).toEqual([{ type: "terminal", job: completed }]);
    expect(sources[0]!.closed).toBe(true);
  });

  it("job Aの遅延GETは後から開始したjob Bを上書きせず、Bの接続を閉じない", async () => {
    let resolveJobA!: (job: ScanJobSnapshot) => void;
    const delayedJobA = new Promise<ScanJobSnapshot>((resolve) => {
      resolveJobA = resolve;
    });
    const startScan = vi.fn<ScanJobDeps["startScan"]>();
    startScan.mockResolvedValueOnce(running).mockResolvedValueOnce(jobB);
    const { store, sources } = createHarness({ startScan, getScanJob: vi.fn(() => delayedJobA) });
    await store.start();
    connectionError(sources[0]!);

    await store.start();
    resolveJobA(completed);
    await flush();
    expect(store.getState().job?.id).toBe("job-2");
    expect(sources[1]!.closed).toBe(false);
  });

  it("terminal後に同じjobの遅延running GETが解決しても状態を巻き戻さない", async () => {
    let resolveRunning!: (job: ScanJobSnapshot) => void;
    const delayedRunning = new Promise<ScanJobSnapshot>((resolve) => {
      resolveRunning = resolve;
    });
    const getScanJob = vi.fn<ScanJobDeps["getScanJob"]>();
    getScanJob.mockReturnValueOnce(delayedRunning).mockResolvedValue(completed);
    const { store, sources } = createHarness({ getScanJob });
    await store.start();
    connectionError(sources[0]!);
    dispatch(sources[0]!, { type: "completed", result });
    await flush();
    expect(store.getState().job?.status).toBe("completed");

    resolveRunning(running);
    await flush();
    expect(store.getState().job?.status).toBe("completed");
  });

  it("途中のprogressを欠いても、再取得とstateで現在状態へ再同期する", async () => {
    const { store, sources, events } = createHarness({
      getScanJob: vi.fn(async () => ({
        ...running,
        progress: { phase: "registering" as const, processed: 5, total: 10 },
      })),
    });
    await store.start();
    const source = sources[0]!;
    dispatch(source, {
      type: "progress",
      progress: { phase: "registering", processed: 1, total: 10 },
    });
    connectionError(source);
    await flush();
    expect(store.getState().job?.progress?.processed).toBe(5);

    dispatch(source, {
      type: "state",
      snapshot: { ...running, progress: { phase: "registering", processed: 9, total: 10 } },
    });
    expect(store.getState().job?.progress?.processed).toBe(9);

    dispatch(source, { type: "state", snapshot: completed });
    expect(store.getState().job?.status).toBe("completed");
    expect(events.filter((event) => event.type === "terminal")).toHaveLength(1);
    expect(source.closed).toBe(true);
  });

  it("queuedのjobはprogressでrunningになる", async () => {
    const { store, sources } = createHarness({
      startScan: vi.fn(async () => ({ ...running, status: "queued" as const })),
    });
    await store.start();
    dispatch(sources[0]!, {
      type: "progress",
      progress: { phase: "walking", processed: 1, total: 0 },
    });
    expect(store.getState().job?.status).toBe("running");
  });

  it("別のjobを追跡し直した後、古い接続のstate/progress/terminalは新しいjobを上書きしない", async () => {
    const startScan = vi.fn<ScanJobDeps["startScan"]>();
    startScan.mockResolvedValueOnce(running).mockResolvedValueOnce(jobB);
    const { store, sources, events } = createHarness({ startScan });
    await store.start();
    await store.start();

    dispatch(sources[0]!, {
      type: "progress",
      progress: { phase: "registering", processed: 3, total: 10 },
    });
    dispatch(sources[0]!, { type: "state", snapshot: completed });
    dispatch(sources[0]!, { type: "completed", result });
    await flush();

    expect(store.getState().job).toEqual(jobB);
    expect(events.filter((event) => event.type === "terminal")).toEqual([]);
    expect(sources[1]!.closed).toBe(false);
  });

  it("遅延active discoveryの失敗は後から開始したjobのerrorを汚染しない", async () => {
    let rejectDiscovery!: (cause: unknown) => void;
    const discovery = new Promise<ScanJobSnapshot | null>((_, reject) => {
      rejectDiscovery = reject;
    });
    const { store } = createHarness({ getActiveScan: vi.fn(() => discovery) });
    const attached = store.attach();
    await store.start();
    rejectDiscovery(new TypeError("old discovery failed"));
    await attached;
    expect(store.getState().job?.id).toBe("job-1");
    expect(store.getState().error).toBeNull();
  });

  it("遅延active discoveryの成功は追跡中のjobを置き換えない", async () => {
    let resolveDiscovery!: (job: ScanJobSnapshot | null) => void;
    const discovery = new Promise<ScanJobSnapshot | null>((resolve) => {
      resolveDiscovery = resolve;
    });
    const { store, sources } = createHarness({ getActiveScan: vi.fn(() => discovery) });
    const attached = store.attach();
    await store.start();
    resolveDiscovery(jobB);
    await attached;
    expect(store.getState().job?.id).toBe("job-1");
    expect(sources).toHaveLength(1);
  });

  it("再取得が5xxでも切り離さず、接続を維持する", async () => {
    const { store, sources } = createHarness({
      getScanJob: vi.fn(async () => {
        throw new ApiRequestError(500, "internal", "temporary");
      }),
    });
    await store.start();
    connectionError(sources[0]!);
    await flush();
    expect(store.getState().job?.status).toBe("running");
    expect(store.getState().error).toBeNull();
    expect(sources[0]!.closed).toBe(false);
  });

  it("再取得が404なら切り離してerrorを持ち、start/cancelの失敗もerrorへ反映する", async () => {
    const getScanJob = vi.fn<ScanJobDeps["getScanJob"]>(async () => {
      throw new ApiRequestError(404, "not_found", "evicted");
    });
    const { store, sources, deps } = createHarness({ getScanJob });
    await store.start();
    connectionError(sources[0]!);
    await flush();
    expect(store.getState()).toMatchObject({ job: null, error: "evicted" });
    expect(sources[0]!.closed).toBe(true);

    vi.mocked(deps.startScan).mockRejectedValueOnce(
      new ApiRequestError(500, "internal", "start failed"),
    );
    expect(await store.start()).toEqual({ ok: false, error: "start failed" });
    expect(store.getState().error).toBe("start failed");

    await store.start();
    vi.mocked(deps.cancelScan).mockRejectedValueOnce(
      new ApiRequestError(500, "internal", "cancel failed"),
    );
    expect(await store.cancel()).toEqual({ ok: false, error: "cancel failed" });
    expect(store.getState().error).toBe("cancel failed");

    store.clearError();
    expect(store.getState().error).toBeNull();
  });

  it("再取得がroot再設定中の409なら追跡を捨て、errorを残さない", async () => {
    const { store, sources } = createHarness({
      getScanJob: vi.fn(async () => {
        throw new ApiRequestError(409, "root_reconfiguring", "reconfiguring");
      }),
    });
    await store.start();
    connectionError(sources[0]!);
    await flush();
    expect(store.getState()).toEqual({ job: null, error: null });
    expect(sources[0]!.closed).toBe(true);
  });

  it("resetは接続を閉じて状態を空にし、以後の古いイベントを無視する", async () => {
    const { store, sources, events } = createHarness();
    await store.start();
    store.reset();
    expect(store.getState()).toEqual({ job: null, error: null });
    expect(sources[0]!.closed).toBe(true);

    dispatch(sources[0]!, { type: "state", snapshot: completed });
    expect(store.getState().job).toBeNull();
    expect(events.filter((event) => event.type === "terminal")).toEqual([]);
  });

  it("不正なJSONイベントでscanningが固着せずerrorを持つ", async () => {
    const { store, sources } = createHarness();
    await store.start();
    sources[0]!.dispatchEvent(new MessageEvent("completed", { data: "not-json" }));
    expect(store.getState()).toEqual({
      job: null,
      error: "スキャン進捗イベントの解析に失敗しました",
    });
    expect(isScanning(store.getState())).toBe(false);
    expect(sources[0]!.closed).toBe(true);
  });

  it("形式が不正なterminalイベントでscanningが固着せずerrorを持つ", async () => {
    const { store, sources } = createHarness();
    await store.start();
    sources[0]!.dispatchEvent(
      new MessageEvent("completed", {
        data: JSON.stringify({ type: "completed", result: "invalid" }),
      }),
    );
    expect(store.getState()).toEqual({
      job: null,
      error: "スキャン進捗イベントの形式が不正です",
    });
    expect(sources[0]!.closed).toBe(true);
  });

  it("failedのjobはerrorを持ち、terminalを通知する", async () => {
    const failed: ScanJobSnapshot = {
      ...running,
      status: "failed",
      finishedAt: "2026-01-01T00:00:01.000Z",
      error: "boom",
    };
    const { store, sources, events } = createHarness();
    await store.start();
    dispatch(sources[0]!, { type: "state", snapshot: failed });
    expect(store.getState()).toEqual({ job: failed, error: "boom" });
    expect(events).toContainEqual({ type: "terminal", job: failed });
  });
});
