import { act, createElement, useMemo, type ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ScanJobEvent, type ScanJobSnapshot } from "@mimimilli/shared";
import { createApiHandler } from "../helpers/api";
import { appShellRoutes } from "../helpers/appShellApi";
import {
  buildScanCandidate,
  buildScanJobEvent,
  buildScanJobSnapshot,
  buildScanRecord,
} from "../helpers/builders";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import { scanJobStoreAtom } from "../../src/entities/scan/model/scanJobStore";
import { toastRequestsAtom } from "../../src/shared/model/toastRequestsAtom";
import { activeModalAtom } from "../../src/shared/model/activeModalAtom";

/** ScanRuntimeの終了通知は単一のuseToast()から出るため、要求は高々1件 */
function latestToastRequest(store: ReturnType<typeof createStore>) {
  return [...store.get(toastRequestsAtom).values()][0];
}

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

const running: ScanJobSnapshot = buildScanJobSnapshot({ startedAt: "2026-01-01T00:00:01.000Z" });

const finishedAt = "2026-01-01T00:00:02.000Z";

const candidate = buildScanCandidate({ path: "未登録作品", inferredTitle: "未登録作品" });

const completedJob: ScanJobSnapshot = buildScanJobSnapshot({
  ...running,
  status: "completed",
  finishedAt,
});

/** 検証対象外の付随リクエスト（設定・候補・通知など）に空ライブラリの既定応答を返す */
const shell = createApiHandler(appShellRoutes());

function response(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: status === 204 ? undefined : { "Content-Type": "application/json" },
  });
}

function dispatchScan(source: FakeEventSource, event: ScanJobEvent): void {
  act(() => {
    const valid = buildScanJobEvent(event);
    source.dispatchEvent(new MessageEvent(valid.type, { data: JSON.stringify(valid) }));
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
async function expectNoUnhandledRejection(run: () => Promise<void>) {
  const rejections: unknown[] = [];
  const handler = (event: PromiseRejectionEvent) => {
    event.preventDefault();
    rejections.push(event.reason);
  };
  window.addEventListener("unhandledrejection", handler);
  try {
    await run();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(rejections).toEqual([]);
  } finally {
    window.removeEventListener("unhandledrejection", handler);
  }
}

describe("ScanRuntime EventSource ownership", () => {
  it("起動時に未登録候補を GET /scan/candidates から1回取得し、取得済みなら取り直さない", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/scan/candidates")) return response({ candidates: [candidate] });
      return shell(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { queryClient } = renderRuntime(createElement(ScanRuntime));

    await waitFor(() =>
      expect(queryClient.getQueryData(SCAN_QUERY_KEYS.candidates())).toEqual([candidate]),
    );
    const candidateCalls = () =>
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/scan/candidates"));
    expect(candidateCalls()).toHaveLength(1);
  });

  it("active job への attach で EventSource を1つだけ生成する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).endsWith("/scan/active") ? response(running) : shell(input, init),
      ),
    );

    renderRuntime(createElement(ScanRuntime));

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    expect(FakeEventSource.instances[0]!.url).toBe("/api/scan/job-1/events");
  });

  it("terminal イベントを2回流しても完了副作用は1回だけ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(running);
        if (url.endsWith("/scan/job-1")) return response(completedJob);
        if (url.endsWith("/scan/candidates")) {
          return response({ candidates: [candidate] });
        }
        return shell(input, init);
      }),
    );

    const { queryClient } = renderRuntime(createElement(ScanRuntime));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    const completed = {
      type: "completed" as const,
      finishedAt,
    };
    dispatchScan(source, completed);
    dispatchScan(source, completed);

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: SCAN_QUERY_KEYS.last() }),
    );
    // 候補の再取得は queryClient.fetchQuery 経由のため、invalidate のスパイではなく
    // 反映後のキャッシュ内容そのものを見る。
    await waitFor(() =>
      expect(queryClient.getQueryData(SCAN_QUERY_KEYS.candidates())).toEqual([candidate]),
    );
    expect(
      invalidate.mock.calls.filter(
        ([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(SCAN_QUERY_KEYS.last()),
      ),
    ).toHaveLength(1);
  });

  it("アンマウント時に EventSource を close する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).endsWith("/scan/active") ? response(running) : shell(input, init),
      ),
    );

    const { unmount } = renderRuntime(createElement(ScanRuntime));
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;
    expect(source.closed).toBe(false);

    unmount();
    expect(source.closed).toBe(true);
  });
  it("候補再取得が失敗しても unhandled rejection にならない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(running);
        if (url.endsWith("/scan/job-1")) return response(completedJob);
        if (url.endsWith("/scan/candidates"))
          return response({ error: { code: "internal", message: "boom" } }, 500);
        return shell(input, init);
      }),
    );

    renderRuntime(createElement(ScanRuntime));
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;

    await expectNoUnhandledRejection(async () => {
      dispatchScan(source, { type: "completed", finishedAt });
      await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    });
  });
});

describe("ScanRuntime: 完了・中止トースト", () => {
  it("スキャンモーダルが閉じていても、完了では今回の変化の件数つきのトーストを出す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(running);
        if (url.endsWith("/scan/job-1")) return response(completedJob);
        if (url.endsWith("/scan/last")) return response(buildScanRecord());
        return shell(input, init);
      }),
    );

    const { store } = renderRuntime(createElement(ScanRuntime));
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    dispatchScan(FakeEventSource.instances[0]!, { type: "completed", finishedAt });
    await waitFor(() =>
      expect(store.get(scanJobStoreAtom).getState().job?.status).toBe("completed"),
    );
    await waitFor(() =>
      expect(latestToastRequest(store)?.message).toBe("スキャン完了・変化はありません"),
    );
  });

  it("中止時は「スキャンを中止しました」トーストを出す", async () => {
    const cancelledJob: ScanJobSnapshot = buildScanJobSnapshot({
      ...running,
      status: "cancelled",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(running);
        if (url.endsWith("/scan/job-1")) return response(cancelledJob);
        return shell(input, init);
      }),
    );

    const { store } = renderRuntime(createElement(ScanRuntime));
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;

    dispatchScan(source, { type: "cancelled" });
    await waitFor(() => expect(latestToastRequest(store)?.message).toBe("スキャンを中止しました"));
  });

  it("スキャンモーダルが開いていれば完了トーストを出さない（サイドバーの完了表示に任せる）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(running);
        if (url.endsWith("/scan/job-1")) return response(completedJob);
        return shell(input, init);
      }),
    );

    const { store } = renderRuntime(createElement(ScanRuntime));
    store.set(activeModalAtom, { kind: "scan" });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;

    dispatchScan(source, { type: "completed", finishedAt });
    await waitFor(() =>
      expect(store.get(scanJobStoreAtom).getState().job?.status).toBe("completed"),
    );
    expect(latestToastRequest(store)).toBeUndefined();
  });
});
