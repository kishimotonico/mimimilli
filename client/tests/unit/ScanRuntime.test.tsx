// ScanRuntime（entities/scan配下）が出すエラートーストの単体テスト。表示自体は
// useToastへ出す契約を固定する。
import { createElement, Fragment, useMemo } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { scanJobStoreAtom } from "../../src/entities/scan/model/scanJobStore";
import { activeModalAtom } from "../../src/shared/model/activeModalAtom";
import { toastRequestsAtom } from "../../src/shared/model/toastRequestsAtom";
import type { ScanJobEvent } from "@mimimilli/shared";
import { apiError, mockApi } from "../helpers/api";
import { appShellRoutes } from "../helpers/appShellApi";
import { buildScanJobEvent, buildScanJobSnapshot, buildScanResult } from "../helpers/builders";

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
    const valid = buildScanJobEvent(event);
    source.dispatchEvent(new MessageEvent(valid.type, { data: JSON.stringify(valid) }));
  });
}

const UNSTRUCTURED_FAILURE = () => new Response("開始できませんでした", { status: 500 });

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
    mockApi({
      ...appShellRoutes(),
      "POST /api/scan": UNSTRUCTURED_FAILURE,
    });

    const { store } = renderRuntime();

    await act(async () => {
      await store.get(scanJobStoreAtom).start();
    });

    await waitFor(() => expect(getErrorToastMessage(store)).not.toBeNull());
    const message = getErrorToastMessage(store)!;
    expect(screen.getByText(message)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    await waitFor(() => expect(getErrorToastMessage(store)).toBeNull());
    await waitFor(() => expect(screen.queryByText(message)).toBeNull());
  });

  it("モーダルを開いたまま失敗→再試行→成功すると古いエラートーストが残らない", async () => {
    const scanResult = buildScanResult({ registered: 1 });
    let scanCallCount = 0;
    mockApi({
      ...appShellRoutes(),
      "POST /api/scan": () => {
        scanCallCount += 1;
        if (scanCallCount === 1) return UNSTRUCTURED_FAILURE();
        return {
          job: buildScanJobSnapshot({
            id: "job-2",
            status: "completed",
            finishedAt: "2026-01-01T00:00:02.000Z",
            result: scanResult,
          }),
        };
      },
    });

    const { store } = renderRuntime();
    store.set(activeModalAtom, { kind: "scan" });

    await act(async () => {
      await store.get(scanJobStoreAtom).start();
    });

    await waitFor(() => expect(getErrorToastMessage(store)).not.toBeNull());
    const message = getErrorToastMessage(store)!;
    expect(screen.getByText(message)).toBeInTheDocument();

    await act(async () => {
      await store.get(scanJobStoreAtom).start();
    });

    await waitFor(() => expect(getErrorToastMessage(store)).toBeNull());
    await waitFor(() => expect(screen.queryByText(message)).toBeNull());
  });

  it("中止APIの失敗でエラーが出た直後にSSEで完了しても、完了トーストは消えずに残る", async () => {
    const scanResult = buildScanResult({ registered: 1 });
    const running = buildScanJobSnapshot();
    const completed = buildScanJobSnapshot({
      status: "completed",
      finishedAt: "2026-01-01T00:00:01.000Z",
      result: scanResult,
    });

    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    mockApi({
      ...appShellRoutes(),
      "POST /api/scan": { job: running },
      "DELETE /api/scan/:id": () => apiError(500, "internal", "中止できませんでした"),
      // SSEの"completed"はrefresh経由でGETするだけで確定するため、GETは完了済みを返す
      "GET /api/scan/:id": completed,
    });

    // scanModalOpenAtomは未設定（閉じている）。完了トーストが出る経路を検証する。
    const { store } = renderRuntime();

    await act(async () => {
      await store.get(scanJobStoreAtom).start();
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;

    // 中止APIがHTTPレベルで失敗し、SSE接続は生きたままエラーだけが残る状態を作る。
    await act(async () => {
      await store.get(scanJobStoreAtom).cancel();
    });
    await waitFor(() => expect(getErrorToastMessage(store)).not.toBeNull());
    const errorMessage = getErrorToastMessage(store)!;
    expect(screen.getByText(errorMessage)).toBeInTheDocument();

    // その直後に同じジョブのSSEが完了を届ける。errorToast.dismiss()とonTerminalの完了トーストが
    // 同じバッチで走る経路（cancel()のHTTP失敗＋SSE生存）を再現する。
    dispatch(source, { type: "completed", result: scanResult });

    await waitFor(() => expect(getErrorToastMessage(store)).toBeNull());
    await waitFor(() => expect(screen.getByText(/^スキャン完了/)).toBeInTheDocument());
    expect(screen.queryByText(errorMessage)).toBeNull();
  });

  it("reset()（root再設定突入時用）を呼ぶと実行中ジョブの追跡状態が初期化される", async () => {
    mockApi({
      ...appShellRoutes(),
      "POST /api/scan": { job: buildScanJobSnapshot() },
    });

    const { store } = renderRuntime();

    await act(async () => {
      await store.get(scanJobStoreAtom).start();
    });
    await waitFor(() => expect(store.get(scanJobStoreAtom).getState().job).not.toBeNull());

    act(() => {
      store.get(scanJobStoreAtom).reset();
    });

    expect(store.get(scanJobStoreAtom).getState().job).toBeNull();
    expect(getErrorToastMessage(store)).toBeNull();
  });

  it("root再設定中の409（root_reconfiguring）でSSE再接続が失敗すると、追跡状態が初期化される（リトライしない）", async () => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    let getJobCallCount = 0;
    mockApi({
      ...appShellRoutes(),
      "POST /api/scan": { job: buildScanJobSnapshot() },
      "GET /api/scan/:id": () => {
        getJobCallCount += 1;
        return apiError(409, "root_reconfiguring", "再設定中です");
      },
    });

    const { store } = renderRuntime();

    await act(async () => {
      await store.get(scanJobStoreAtom).start();
    });
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const source = FakeEventSource.instances[0]!;

    // SSE接続エラー→refresh()→GET /scan/job-1 が409 root_reconfiguringを返す経路を再現する。
    act(() => {
      source.onerror?.(new Event("error"));
    });

    await waitFor(() => expect(store.get(scanJobStoreAtom).getState().job).toBeNull());
    expect(getErrorToastMessage(store)).toBeNull();
    // リトライや待機ループを足していないため、1回のGETで終わっている。
    expect(getJobCallCount).toBe(1);
  });

  // App.handlePlay/handleResumeのprepareWorkPlayback呼び出しと同じ「直接API呼び出し→
  // catch→isRootReconfiguringErrorで判定→トーストを出さない」パターンをstart()で縛る。
  // 画面がreconfiguringへ切り替わるのが正しい応答であり、「失敗」トーストは不要。
  it("start()が409（root_reconfiguring）で失敗してもトースト要求が積まれない", async () => {
    mockApi({
      ...appShellRoutes(),
      "POST /api/scan": () => apiError(409, "root_reconfiguring", "再設定中です"),
    });

    const { store } = renderRuntime();

    const result = await act(async () => store.get(scanJobStoreAtom).start());

    expect(result.ok).toBe(false);
    expect(getErrorToastMessage(store)).toBeNull();
    expect(store.get(toastRequestsAtom).size).toBe(0);
  });
});
