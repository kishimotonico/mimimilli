// ScanRuntime（entities/scan配下）が出すエラートーストの単体テスト。表示自体は
// useToastへ出す契約を固定する。
import { createElement, Fragment, useMemo } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { scanActionsAtom } from "../../src/entities/scan/model/atoms";
import { activeModalAtom } from "../../src/shared/model/activeModalAtom";
import { toastRequestsAtom } from "../../src/shared/model/toastRequestsAtom";
import type { ScanJobEvent, ScanResult } from "@mimimilli/shared";

/** 現在表示中のerror variantトーストのメッセージ。無ければnull。 */
function getErrorToastMessage(store: ReturnType<typeof createStore>): string | null {
  const requests = store.get(toastRequestsAtom);
  for (const request of requests.values()) {
    if (request.variant === "error") return request.message;
  }
  return null;
}

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

function dispatch(source: FakeEventSource, event: ScanJobEvent): void {
  act(() => {
    source.dispatchEvent(new MessageEvent(event.type, { data: JSON.stringify(event) }));
  });
}

function response(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: status === 204 ? undefined : { "Content-Type": "application/json" },
  });
}

function renderRuntime() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createStore();

  function Wrapper() {
    const client = useMemo(() => queryClient, []);
    const jotaiStore = useMemo(() => store, []);
    return createElement(
      QueryClientProvider,
      { client },
      createElement(
        JotaiProvider,
        { store: jotaiStore },
        createElement(Fragment, null, createElement(ScanRuntime), createElement(GlobalToast)),
      ),
    );
  }

  render(createElement(Wrapper));
  return { store };
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ScanRuntime", () => {
  it("スキャン開始に失敗するとerrorトーストを出し、閉じると消える", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(null, 204);
        if (url.endsWith("/scan")) return response({ message: "開始できませんでした" }, 500);
        return response(null, 204);
      }),
    );

    const { store } = renderRuntime();
    await waitFor(() => expect(store.get(scanActionsAtom)).not.toBeNull());

    await act(async () => {
      await store.get(scanActionsAtom)!.start();
    });

    await waitFor(() => expect(getErrorToastMessage(store)).not.toBeNull());
    const message = getErrorToastMessage(store)!;
    expect(screen.getByText(message)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    await waitFor(() => expect(getErrorToastMessage(store)).toBeNull());
    await waitFor(() => expect(screen.queryByText(message)).toBeNull());
  });

  it("モーダルを開いたまま失敗→再試行→成功すると古いエラートーストが残らない", async () => {
    const scanResult: ScanResult = {
      registered: 1,
      insertedWorkIds: [],
      updatedWorkIds: [],
      errors: 0,
      missing: 0,
      rjCodeMissingCount: 0,
      skipped: 0,
      coverErrors: 0,
      identityConflicts: [],
      invalidMetaFiles: [],
      candidates: [],
    };
    let scanCallCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(null, 204);
        if (url.endsWith("/scan")) {
          scanCallCount += 1;
          if (scanCallCount === 1) return response({ message: "開始できませんでした" }, 500);
          return response({
            job: {
              id: "job-2",
              status: "completed",
              createdAt: new Date().toISOString(),
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
              progress: null,
              result: scanResult,
              error: null,
            },
          });
        }
        return response(null, 204);
      }),
    );

    const { store } = renderRuntime();
    store.set(activeModalAtom, { kind: "scan" });
    await waitFor(() => expect(store.get(scanActionsAtom)).not.toBeNull());

    await act(async () => {
      await store.get(scanActionsAtom)!.start();
    });

    await waitFor(() => expect(getErrorToastMessage(store)).not.toBeNull());
    const message = getErrorToastMessage(store)!;
    expect(screen.getByText(message)).toBeTruthy();

    await act(async () => {
      await store.get(scanActionsAtom)!.start();
    });

    await waitFor(() => expect(getErrorToastMessage(store)).toBeNull());
    await waitFor(() => expect(screen.queryByText(message)).toBeNull());
  });

  it("中止APIの失敗でエラーが出た直後にSSEで完了しても、完了トーストは消えずに残る", async () => {
    const scanResult: ScanResult = {
      registered: 1,
      insertedWorkIds: [],
      updatedWorkIds: [],
      errors: 0,
      missing: 0,
      rjCodeMissingCount: 0,
      skipped: 0,
      coverErrors: 0,
      identityConflicts: [],
      invalidMetaFiles: [],
      candidates: [],
    };
    const running = {
      id: "job-1",
      status: "running" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      startedAt: "2026-01-01T00:00:00.001Z",
      finishedAt: null,
      progress: null,
      result: null,
      error: null,
    };

    const completed = {
      ...running,
      status: "completed" as const,
      finishedAt: "2026-01-01T00:00:01.000Z",
      result: scanResult,
    };

    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/scan/active")) return response(null, 204);
        if (url.endsWith("/scan") && init?.method === "POST") return response({ job: running });
        if (url.endsWith("/scan/job-1") && init?.method === "DELETE") {
          return response({ error: { code: "internal", message: "中止できませんでした" } }, 500);
        }
        // SSEの"completed"はrefresh経由でGETするだけで確定するため、GETは完了済みを返す
        if (url.endsWith("/scan/job-1")) return response(completed);
        return response(null, 204);
      }),
    );

    // scanModalOpenAtomは未設定（閉じている）。完了トーストが出る経路を検証する。
    const { store } = renderRuntime();
    await waitFor(() => expect(store.get(scanActionsAtom)).not.toBeNull());

    await act(async () => {
      await store.get(scanActionsAtom)!.start();
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;

    // 中止APIがHTTPレベルで失敗し、SSE接続は生きたままエラーだけが残る状態を作る。
    await act(async () => {
      await store.get(scanActionsAtom)!.cancel();
    });
    await waitFor(() => expect(getErrorToastMessage(store)).not.toBeNull());
    const errorMessage = getErrorToastMessage(store)!;
    expect(screen.getByText(errorMessage)).toBeTruthy();

    // その直後に同じジョブのSSEが完了を届ける。errorToast.dismiss()とonTerminalの完了トーストが
    // 同じバッチで走る経路（cancel()のHTTP失敗＋SSE生存）を再現する。
    dispatch(source, { type: "completed", seq: 1, result: scanResult });

    await waitFor(() => expect(getErrorToastMessage(store)).toBeNull());
    await waitFor(() => expect(screen.getByText(/^スキャン完了/)).toBeTruthy());
    expect(screen.queryByText(errorMessage)).toBeNull();
  });
});
