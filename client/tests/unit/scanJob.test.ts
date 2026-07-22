import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanJobEvent, ScanJobSnapshot } from "@mimimilli/shared";
import { useScanJob } from "../../src/features/scan/useScanJob";

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
  newlyGenerated: 0,
  errors: 0,
  missing: 0,
  newWorkIds: [],
  rjCodeMissingCount: 0,
};
const completed: ScanJobSnapshot = {
  ...running,
  status: "completed",
  finishedAt: "2026-01-01T00:00:01.000Z",
  result,
};

function response(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: status === 204 ? undefined : { "Content-Type": "application/json" },
  });
}

function dispatch(source: FakeEventSource, event: ScanJobEvent): void {
  act(() => {
    source.dispatchEvent(new MessageEvent(event.type, { data: JSON.stringify(event) }));
  });
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useScanJob", () => {
  it("mount/reloadでactiveへattachし、state/progress/terminalを反映して副作用を一度だけ呼ぶ", async () => {
    const onTerminal = vi.fn();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/scan/active")) return response(running);
      if (url.endsWith("/scan/job-1")) return response(completed);
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = renderHook(() => useScanJob({ onTerminal }));
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    dispatch(source, {
      type: "reset",
      seq: 0,
      snapshot: {
        ...running,
        progress: { phase: "walking", processed: 10, total: 0 },
      },
    });
    expect(first.result.current.job?.progress?.processed).toBe(10);
    dispatch(source, {
      type: "progress",
      seq: 1,
      progress: { phase: "registering", processed: 2, total: 5 },
    });
    expect(first.result.current.job?.progress?.processed).toBe(2);
    dispatch(source, {
      type: "state",
      seq: 2,
      snapshot: { ...running, status: "cancelling" },
    });
    expect(first.result.current.job?.status).toBe("cancelling");
    dispatch(source, { type: "completed", seq: 3, result });
    await waitFor(() => expect(onTerminal).toHaveBeenCalledTimes(1));
    dispatch(source, { type: "completed", seq: 3, result });
    await waitFor(() => expect(onTerminal).toHaveBeenCalledTimes(1));
    first.unmount();

    renderHook(() => useScanJob({ onTerminal }));
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(2));
  });

  it("POST 409ではactiveへattachし、cancel responseのcancellingを反映する", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/scan/active")) return response(null, 204);
      if (url.endsWith("/scan") && init?.method === "POST") {
        return response(
          { error: { code: "conflict", message: "already active" }, active: running },
          409,
        );
      }
      if (url.endsWith("/scan/job-1") && init?.method === "DELETE") {
        return response({ ...running, status: "cancelling" });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const hook = renderHook(() => useScanJob());
    await act(async () => {
      await hook.result.current.start();
    });
    expect(hook.result.current.job?.id).toBe("job-1");
    await act(async () => {
      await hook.result.current.cancel();
    });
    expect(hook.result.current.job?.status).toBe("cancelling");
  });

  it("SSE error時にGETでterminalを補完する", async () => {
    const onTerminal = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/scan/active") ? response(running) : response(completed),
      ),
    );
    renderHook(() => useScanJob({ onTerminal }));
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    act(() => FakeEventSource.instances[0]!.onerror?.(new Event("error")));
    await waitFor(() => expect(onTerminal).toHaveBeenCalledTimes(1));
  });

  it("job Aの遅延GETは後からattachしたjob Bを上書きせず、Bのsourceを閉じない", async () => {
    let resolveJobA!: (value: Response) => void;
    const delayedJobA = new Promise<Response>((resolve) => {
      resolveJobA = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(null, 204);
        if (url.endsWith("/scan/job-1")) return delayedJobA;
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const hook = renderHook(() => useScanJob());
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    act(() => hook.result.current.attach(running));
    const sourceA = FakeEventSource.instances.at(-1)!;
    dispatch(sourceA, { type: "completed", seq: 1, result });

    const jobB: ScanJobSnapshot = { ...running, id: "job-2" };
    act(() => hook.result.current.attach(jobB));
    const sourceB = FakeEventSource.instances.at(-1)!;
    resolveJobA(response(completed));
    await act(async () => {
      await Promise.resolve();
    });
    expect(hook.result.current.job?.id).toBe("job-2");
    expect(sourceB.closed).toBe(false);
  });

  it("terminal後に同じjobの遅延running GETが解決しても状態を巻き戻さない", async () => {
    let resolveRunning!: (value: Response) => void;
    const delayedRunning = new Promise<Response>((resolve) => {
      resolveRunning = resolve;
    });
    let statusReads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(running);
        if (url.endsWith("/scan/job-1")) {
          statusReads++;
          return statusReads === 1 ? delayedRunning : response(completed);
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const hook = renderHook(() => useScanJob());
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    act(() => source.onerror?.(new Event("error")));
    dispatch(source, { type: "completed", seq: 2, result });
    await waitFor(() => expect(hook.result.current.job?.status).toBe("completed"));
    resolveRunning(response(running));
    await act(async () => {
      await Promise.resolve();
    });
    expect(hook.result.current.job?.status).toBe("completed");
  });

  it("遅延active discoveryの失敗は後からattachしたjobのerrorを汚染しない", async () => {
    let rejectDiscovery!: (cause: unknown) => void;
    const discovery = new Promise<Response>((_, reject) => {
      rejectDiscovery = reject;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => discovery),
    );
    const hook = renderHook(() => useScanJob());
    act(() => hook.result.current.attach({ ...running, id: "job-2" }));
    rejectDiscovery(new TypeError("old discovery failed"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(hook.result.current.job?.id).toBe("job-2");
    expect(hook.result.current.error).toBeNull();
  });

  it("refresh 5xxではdetachせずEventSourceの再接続を維持する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/scan/active")
          ? response(running)
          : response({ error: { code: "internal", message: "temporary" } }, 500),
      ),
    );
    const hook = renderHook(() => useScanJob());
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    act(() => source.onerror?.(new Event("error")));
    await act(async () => {
      await Promise.resolve();
    });
    expect(hook.result.current.job?.status).toBe("running");
    expect(hook.result.current.error).toBeNull();
    expect(source.closed).toBe(false);
  });

  it("refresh 404はattachを解除してerrorを表示し、start/cancel失敗もerrorへ反映する", async () => {
    let mode: "refresh404" | "start500" | "cancel500" = "refresh404";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(null, 204);
        if (url.endsWith("/scan/job-1") && init?.method === "DELETE") {
          return response({ error: { code: "internal", message: "cancel failed" } }, 500);
        }
        if (url.endsWith("/scan/job-1")) {
          return response({ error: { code: "not_found", message: "evicted" } }, 404);
        }
        if (url.endsWith("/scan") && init?.method === "POST") {
          return response({ error: { code: "internal", message: "start failed" } }, 500);
        }
        throw new Error(`unexpected fetch (${mode}): ${url}`);
      }),
    );
    const hook = renderHook(() => useScanJob());
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    act(() => hook.result.current.attach(running));
    const source = FakeEventSource.instances.at(-1)!;
    act(() => source.onerror?.(new Event("error")));
    await waitFor(() => expect(hook.result.current.job).toBeNull());
    expect(hook.result.current.error).toMatch(/404/);
    expect(source.closed).toBe(true);

    mode = "start500";
    await act(async () => {
      await hook.result.current.start().catch(() => {});
    });
    expect(hook.result.current.error).toMatch(/500/);

    mode = "cancel500";
    act(() => hook.result.current.attach(running));
    await act(async () => {
      await hook.result.current.cancel().catch(() => {});
    });
    expect(hook.result.current.error).toMatch(/500/);
  });
});
