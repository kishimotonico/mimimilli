import { act, createElement, useMemo, type ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanJobEvent, ScanJobSnapshot } from "@mimimilli/shared";
import DlsiteBulkRuntime from "../../src/features/dlsite/ui/DlsiteBulkRuntime";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import {
  dlsiteBulkActiveAtom,
  dlsiteBulkActionsAtom,
  dlsiteBulkErrorAtom,
  dlsiteBulkProgressAtom,
  dlsiteBulkStartingAtom,
  dlsiteBulkResultAtom,
} from "../../src/entities/dlsite/model/bulkAtoms";

class FakeEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  static instances: FakeEventSource[] = [];
  readonly url: string;
  closed = false;
  readyState = FakeEventSource.OPEN;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    super.addEventListener(type, listener);
  }

  dispatchEvent(event: Event): boolean {
    const handled = super.dispatchEvent(event);
    if (event.type === "error" && this.onerror) {
      this.onerror(event);
    }
    return handled;
  }
}

const running: ScanJobSnapshot = {
  id: "job-1",
  status: "running",
  createdAt: "2026-01-01T00:00:00.000Z",
  startedAt: "2026-01-01T00:00:01.000Z",
  finishedAt: null,
  progress: null,
  result: null,
  error: null,
};

const scanResult = {
  registered: 1,
  newlyGenerated: 0,
  errors: 0,
  missing: 0,
  newWorkIds: [],
  rjCodeMissingCount: 0,
  skipped: 0,
  coverErrors: 0,
};

const dlsiteResult = {
  fetched: 2,
  failed: 0,
  parseErrors: 0,
  skipped: 0,
};

const completedJob: ScanJobSnapshot = {
  ...running,
  status: "completed",
  finishedAt: "2026-01-01T00:00:02.000Z",
  result: scanResult,
};

function response(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: status === 204 ? undefined : { "Content-Type": "application/json" },
  });
}

function dispatchScan(source: FakeEventSource, event: ScanJobEvent): void {
  act(() => {
    source.dispatchEvent(new MessageEvent(event.type, { data: JSON.stringify(event) }));
  });
}

function dispatchDlsite(source: FakeEventSource, type: string, data: unknown): void {
  act(() => {
    source.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
  });
}

function renderRuntime(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = createStore();

  function Wrapper() {
    const client = useMemo(() => queryClient, []);
    const jotaiStore = useMemo(() => store, []);
    return createElement(
      QueryClientProvider,
      { client },
      createElement(JotaiProvider, { store: jotaiStore }, children),
    );
  }

  const view = render(createElement(Wrapper));
  return { ...view, queryClient, store };
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ScanRuntime EventSource ownership", () => {
  it("active job への attach で EventSource を1つだけ生成する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/scan/active") ? response(running) : response(null, 204),
      ),
    );

    renderRuntime(createElement(ScanRuntime));

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    expect(FakeEventSource.instances[0]!.url).toBe("/api/scan/job-1/events");
  });

  it("terminal イベントを2回流しても完了副作用は1回だけ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(running);
        if (url.endsWith("/scan/job-1")) return response(completedJob);
        return response(null, 204);
      }),
    );

    const { queryClient } = renderRuntime(createElement(ScanRuntime));
    const setQueryData = vi.spyOn(queryClient, "setQueryData");

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    const completed = {
      type: "completed" as const,
      seq: 1,
      result: scanResult,
    };
    dispatchScan(source, completed);
    dispatchScan(source, completed);

    await waitFor(() => expect(setQueryData).toHaveBeenCalledTimes(1));
    expect(setQueryData).toHaveBeenCalledWith(
      SCAN_QUERY_KEYS.last(),
      expect.objectContaining({ result: scanResult }),
    );
  });

  it("アンマウント時に EventSource を close する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/scan/active") ? response(running) : response(null, 204),
      ),
    );

    const { unmount } = renderRuntime(createElement(ScanRuntime));
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    expect(source.closed).toBe(false);

    unmount();
    expect(source.closed).toBe(true);
  });
});

describe("Runtime間連携: ScanRuntime → DlsiteBulkRuntime", () => {
  it("newWorkIds を含む完了イベントで dlsiteBulk.attach が一度だけ成立する", async () => {
    const scanResultWithNewWorks = { ...scanResult, newWorkIds: ["work-1"] };
    const completedWithNewWorks: ScanJobSnapshot = {
      ...completedJob,
      result: scanResultWithNewWorks,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(running);
        if (url.endsWith("/scan/job-1")) return response(completedWithNewWorks);
        return response(null, 204);
      }),
    );

    // 実際の Provider 構成で ScanRuntime と DlsiteBulkRuntime を同じ store 上に描画する。
    const { store } = renderRuntime([
      createElement(ScanRuntime, { key: "scan" }),
      createElement(DlsiteBulkRuntime, { key: "dlsite" }),
    ]);

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const scanSource = FakeEventSource.instances[0]!;
    const completed = { type: "completed" as const, seq: 1, result: scanResultWithNewWorks };
    dispatchScan(scanSource, completed);
    dispatchScan(scanSource, completed);

    // attach() → dlsiteBulkActiveAtom が true になり、DlsiteBulkRuntime が EventSource を1つだけ開く。
    await waitFor(() => expect(store.get(dlsiteBulkActiveAtom)).toBe(true));
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(2));
    expect(FakeEventSource.instances[1]!.url).toBe("/api/dlsite/events");
  });
});

describe("DlsiteBulkRuntime EventSource ownership", () => {
  it("active 時に EventSource を1つだけ生成する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ ok: true })),
    );

    const { store } = renderRuntime(createElement(DlsiteBulkRuntime));
    act(() => {
      store.set(dlsiteBulkActiveAtom, true);
    });

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    expect(FakeEventSource.instances[0]!.url).toBe("/api/dlsite/events");
  });

  it("complete イベントを2回流しても完了処理は1回だけ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ ok: true })),
    );

    const { store, queryClient } = renderRuntime(createElement(DlsiteBulkRuntime));
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      store.set(dlsiteBulkActiveAtom, true);
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    const complete = { type: "complete", result: dlsiteResult };
    dispatchDlsite(source, "complete", complete);

    await waitFor(() => expect(invalidateQueries).toHaveBeenCalled());
    const callsAfterFirst = invalidateQueries.mock.calls.length;
    expect(store.get(dlsiteBulkResultAtom)).toEqual(dlsiteResult);

    dispatchDlsite(source, "complete", complete);
    await act(async () => {
      await Promise.resolve();
    });
    expect(invalidateQueries.mock.calls.length).toBe(callsAfterFirst);
  });

  it("アンマウント時に EventSource を close する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ ok: true })),
    );

    const { store, unmount } = renderRuntime(createElement(DlsiteBulkRuntime));
    act(() => {
      store.set(dlsiteBulkActiveAtom, true);
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;

    unmount();
    expect(source.closed).toBe(true);
  });

  it("start は POST 成功後にのみ EventSource を開く", async () => {
    let resolvePost!: () => void;
    const postGate = new Promise<void>((resolve) => {
      resolvePost = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/dlsite/bulk") && init?.method === "POST") {
          await postGate;
          return response({ started: true }, 202);
        }
        return response(null, 204);
      }),
    );

    const { store } = renderRuntime(createElement(DlsiteBulkRuntime));
    await waitFor(() => expect(store.get(dlsiteBulkActionsAtom)).not.toBeNull());
    const startPromise = act(async () => {
      await store.get(dlsiteBulkActionsAtom)!.start();
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(FakeEventSource.instances).toHaveLength(0);

    resolvePost();
    await startPromise;
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    expect(store.get(dlsiteBulkActiveAtom)).toBe(true);
  });

  it("start()から購読を開始した場合、完了時は処理対象workIdの詳細キャッシュだけを無効化する（skippedを含む全作品は無効化しない）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/dlsite/bulk") && init?.method === "POST") {
          return response({ started: true }, 202);
        }
        return response({ ok: true });
      }),
    );

    const { store, queryClient } = renderRuntime(createElement(DlsiteBulkRuntime));
    await waitFor(() => expect(store.get(dlsiteBulkActionsAtom)).not.toBeNull());
    await act(async () => {
      await store.get(dlsiteBulkActionsAtom)!.start();
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;

    dispatchDlsite(source, "progress", {
      type: "progress",
      processed: 1,
      total: 2,
      workId: "work-1",
    });
    dispatchDlsite(source, "progress", {
      type: "progress",
      processed: 2,
      total: 2,
      workId: "work-2",
    });

    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    dispatchDlsite(source, "complete", {
      type: "complete",
      result: { fetched: 2, failed: 0, parseErrors: 0, skipped: 3 },
    });

    await waitFor(() => expect(invalidateQueries).toHaveBeenCalled());
    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]!.queryKey);
    expect(invalidatedKeys).toContainEqual(["work", "work-1"]);
    expect(invalidatedKeys).toContainEqual(["work", "work-2"]);
    // skippedだった（progressイベントが来なかった）作品を含む全作品プレフィックスは含めない
    expect(invalidatedKeys).not.toContainEqual(["work"]);
  });

  it("start()後にSSEが切断→再接続した場合、progressの取りこぼしがあり得るため完了時は全作品を無効化する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/dlsite/bulk") && init?.method === "POST") {
          return response({ started: true }, 202);
        }
        return response({ ok: true });
      }),
    );

    const { store, queryClient } = renderRuntime(createElement(DlsiteBulkRuntime));
    await waitFor(() => expect(store.get(dlsiteBulkActionsAtom)).not.toBeNull());
    await act(async () => {
      await store.get(dlsiteBulkActionsAtom)!.start();
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;

    dispatchDlsite(source, "progress", {
      type: "progress",
      processed: 1,
      total: 2,
      workId: "work-1",
    });
    // ネイティブerror（再接続）: この間のprogressイベントを取りこぼした可能性がある
    source.readyState = FakeEventSource.CONNECTING;
    act(() => {
      source.dispatchEvent(new Event("error"));
    });
    await act(async () => {
      await Promise.resolve();
    });

    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    dispatchDlsite(source, "complete", {
      type: "complete",
      result: { fetched: 2, failed: 0, parseErrors: 0, skipped: 0 },
    });

    await waitFor(() => expect(invalidateQueries).toHaveBeenCalled());
    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]!.queryKey);
    expect(invalidatedKeys).toContainEqual(["work"]);
  });

  it("接続が CLOSED かつジョブなしのとき active を解除してエラーを表示する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/dlsite/bulk") ? response(null, 204) : response({ ok: true }),
      ),
    );

    const { store } = renderRuntime(createElement(DlsiteBulkRuntime));
    act(() => {
      store.set(dlsiteBulkActiveAtom, true);
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    source.readyState = FakeEventSource.CLOSED;
    act(() => {
      source.dispatchEvent(new Event("error"));
    });

    await waitFor(() => expect(store.get(dlsiteBulkActiveAtom)).toBe(false));
    expect(store.get(dlsiteBulkErrorAtom)).toBe("DLsite一括取得の接続が切断されました");
  });

  it("start の多重呼び出しで POST は1回だけ", async () => {
    let resolvePost!: () => void;
    const postGate = new Promise<void>((resolve) => {
      resolvePost = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/dlsite/bulk") && init?.method === "POST") {
        await postGate;
        return response({ started: true }, 202);
      }
      return response(null, 204);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { store } = renderRuntime(createElement(DlsiteBulkRuntime));
    await waitFor(() => expect(store.get(dlsiteBulkActionsAtom)).not.toBeNull());
    act(() => {
      void store.get(dlsiteBulkActionsAtom)!.start();
      void store.get(dlsiteBulkActionsAtom)!.start();
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) => String(input).endsWith("/dlsite/bulk") && init?.method === "POST",
      ),
    ).toHaveLength(1);
    expect(store.get(dlsiteBulkStartingAtom)).toBe(true);

    resolvePost();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(store.get(dlsiteBulkStartingAtom)).toBe(false);
  });

  it("ネイティブ error で status 照会は1回だけ走る", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/dlsite/bulk") && init?.method !== "POST") {
        return response({ status: "running", progress: { processed: 1, total: 5 } });
      }
      return response({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { store } = renderRuntime(createElement(DlsiteBulkRuntime));
    act(() => {
      store.set(dlsiteBulkActiveAtom, true);
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    source.readyState = FakeEventSource.CONNECTING;
    act(() => {
      source.dispatchEvent(new Event("error"));
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(
      fetchMock.mock.calls.filter(
        ([input, init]) => String(input).endsWith("/dlsite/bulk") && init?.method !== "POST",
      ),
    ).toHaveLength(1);
    expect(store.get(dlsiteBulkActiveAtom)).toBe(true);
  });

  it("CLOSED かつジョブ実行中の status 照会で active を解除する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/dlsite/bulk")
          ? response({ status: "running", progress: { processed: 1, total: 5 } })
          : response({ ok: true }),
      ),
    );

    const { store } = renderRuntime(createElement(DlsiteBulkRuntime));
    act(() => {
      store.set(dlsiteBulkActiveAtom, true);
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    source.readyState = FakeEventSource.CLOSED;
    act(() => {
      source.dispatchEvent(new Event("error"));
    });

    await waitFor(() => expect(store.get(dlsiteBulkActiveAtom)).toBe(false));
    expect(store.get(dlsiteBulkErrorAtom)).toBe("DLsite一括取得の接続が切断されました");
  });

  it("一時切断中は error リスナー経由のネイティブ Event でも active を維持する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/dlsite/bulk")
          ? response({ status: "running", progress: { processed: 1, total: 5 } })
          : response({ ok: true }),
      ),
    );

    const { store } = renderRuntime(createElement(DlsiteBulkRuntime));
    act(() => {
      store.set(dlsiteBulkActiveAtom, true);
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    source.readyState = FakeEventSource.CONNECTING;
    act(() => {
      source.dispatchEvent(new Event("error"));
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(store.get(dlsiteBulkActiveAtom)).toBe(true);
    expect(store.get(dlsiteBulkErrorAtom)).toBeNull();
    expect(source.closed).toBe(false);
  });

  it("遅延した status 照会の古い terminal が SSE 進捗で無効化される", async () => {
    let resolveStatus!: (value: Response) => void;
    const delayedStatus = new Promise<Response>((resolve) => {
      resolveStatus = resolve;
    });
    const staleResult = { fetched: 99, failed: 0, parseErrors: 0, skipped: 0 };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/dlsite/bulk")) return delayedStatus;
        return response({ ok: true });
      }),
    );

    const { store } = renderRuntime(createElement(DlsiteBulkRuntime));
    act(() => {
      store.set(dlsiteBulkActiveAtom, true);
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    source.readyState = FakeEventSource.CONNECTING;
    act(() => {
      source.dispatchEvent(new Event("error"));
    });
    dispatchDlsite(source, "progress", {
      type: "progress",
      processed: 3,
      total: 5,
      workId: "work-1",
    });
    resolveStatus(response({ status: "complete", result: staleResult }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(store.get(dlsiteBulkActiveAtom)).toBe(true);
    expect(store.get(dlsiteBulkProgressAtom)).toEqual({ processed: 3, total: 5 });
    expect(store.get(dlsiteBulkResultAtom)).toBeNull();
  });

  it("不正な terminal イベントで active が固着しない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ ok: true })),
    );

    const { store } = renderRuntime(createElement(DlsiteBulkRuntime));
    act(() => {
      store.set(dlsiteBulkActiveAtom, true);
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    dispatchDlsite(source, "complete", { type: "complete", result: "invalid" });

    await waitFor(() => expect(store.get(dlsiteBulkActiveAtom)).toBe(false));
    expect(store.get(dlsiteBulkErrorAtom)).toBe("DLsite進捗イベントの形式が不正です");
    expect(store.get(dlsiteBulkResultAtom)).toBeNull();
  });
});
