import { act, createElement, useMemo, type ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanJobEvent, ScanJobSnapshot } from "@mimimilli/shared";
import DlsiteBulkRuntime from "../../src/features/dlsite/ui/DlsiteBulkRuntime";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import { dlsiteBulkActiveAtom, dlsiteBulkResultAtom } from "../../src/features/dlsite/model/atoms";

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  closed = false;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    super.addEventListener(type, listener);
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
});
