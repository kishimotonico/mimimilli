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
import { scanEntrySeenAtom } from "../../src/features/scan/model/scanEntrySeen";
import { activeModalAtom } from "../../src/shared/model/activeModalAtom";
import { toastRequestsAtom } from "../../src/shared/model/toastRequestsAtom";
import type { ScanJobEvent } from "@mimimilli/shared";
import { apiError, mockApi } from "../helpers/api";
import { appShellRoutes } from "../helpers/appShellApi";
import {
  buildScanJobEvent,
  buildScanJobSnapshot,
  buildScanRecord,
  buildWorksPage,
} from "../helpers/builders";

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

const UPDATED_WORK = { workId: "work-u", changes: [{ kind: "meta" as const }] };

const CHANGES_ROUTES = {
  "GET /api/scan/last": () => buildScanRecord(),
  "GET /api/works": () => buildWorksPage([], { total: 0 }),
} as const;

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

  it("中止APIの失敗でエラーが出た直後にSSEで完了すると、エラートーストは消え、完了トーストが出る", async () => {
    const running = buildScanJobSnapshot();
    const completed = buildScanJobSnapshot({
      status: "completed",
      finishedAt: "2026-01-01T00:00:01.000Z",
    });

    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    mockApi({
      ...appShellRoutes(),
      ...CHANGES_ROUTES,
      "POST /api/scan": { job: running },
      "DELETE /api/scan/:id": () => apiError(500, "internal", "中止できませんでした"),
      // SSEの"completed"はrefresh経由でGETするだけで確定するため、GETは完了済みを返す
      "GET /api/scan/:id": completed,
    });

    // scanModalOpenAtomは未設定（閉じている）。
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

    dispatch(source, { type: "completed", finishedAt: "2026-01-01T00:00:01.000Z" });

    await waitFor(() => expect(getErrorToastMessage(store)).toBeNull());
    await waitFor(() => expect(screen.queryByText(errorMessage)).toBeNull());
    expect(await screen.findByText(/^スキャン完了/)).toBeInTheDocument();
  });

  describe("終端のトースト（遅延・失敗を注入）", () => {
    async function startAndGetSource(
      routes: Parameters<typeof mockApi>[0],
      options: { modalOpen: boolean },
    ) {
      FakeEventSource.instances = [];
      vi.stubGlobal("EventSource", FakeEventSource);
      mockApi({
        ...appShellRoutes(),
        ...CHANGES_ROUTES,
        "POST /api/scan": { job: buildScanJobSnapshot() },
        ...routes,
      });
      const { store } = renderRuntime();
      if (options.modalOpen) store.set(activeModalAtom, { kind: "scan" });
      await act(async () => {
        await store.get(scanJobStoreAtom).start();
      });
      await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
      return { store, source: FakeEventSource.instances[0]! };
    }

    it("閉じている間の完了は、今回の変化の件数を出し、開くでモーダルを開ける", async () => {
      const { store, source } = await startAndGetSource(
        {
          "GET /api/scan/:id": buildScanJobSnapshot({
            status: "completed",
            finishedAt: "2026-01-01T00:00:01.000Z",
          }),
          "GET /api/scan/last": buildScanRecord({ updatedWorks: [UPDATED_WORK] }),
          "GET /api/works": () => buildWorksPage([], { total: 3 }),
        },
        { modalOpen: false },
      );

      dispatch(source, { type: "completed", finishedAt: "2026-01-01T00:00:01.000Z" });

      expect(await screen.findByText("スキャン完了・新規作品3件・更新済み1件")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "開く" }));
      expect(store.get(activeModalAtom)).toEqual({ kind: "scan" });
    });

    it("変化がなければ、そう出す", async () => {
      const { source } = await startAndGetSource(
        {
          "GET /api/scan/:id": buildScanJobSnapshot({
            status: "completed",
            finishedAt: "2026-01-01T00:00:01.000Z",
          }),
        },
        { modalOpen: false },
      );

      dispatch(source, { type: "completed", finishedAt: "2026-01-01T00:00:01.000Z" });

      expect(await screen.findByText("スキャン完了・変化はありません")).toBeInTheDocument();
    });

    it("閉じている間の中止は完了を出さず、通常のトーストで知らせる", async () => {
      const { store, source } = await startAndGetSource(
        {
          "GET /api/scan/:id": buildScanJobSnapshot({
            status: "cancelled",
            finishedAt: "2026-01-01T00:00:01.000Z",
          }),
        },
        { modalOpen: false },
      );

      dispatch(source, { type: "cancelled" });

      expect(await screen.findByText("スキャンを中止しました")).toBeInTheDocument();
      expect(screen.queryByText(/^スキャン完了/)).toBeNull();
      expect(getErrorToastMessage(store)).toBeNull();
    });

    it("閉じている間の失敗は理由つきのエラートーストで、時間が経っても消えない", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        const { store, source } = await startAndGetSource(
          {
            "GET /api/scan/:id": buildScanJobSnapshot({
              status: "failed",
              error: "フォルダーが見つかりません",
              finishedAt: "2026-01-01T00:00:01.000Z",
            }),
          },
          { modalOpen: false },
        );

        dispatch(source, { type: "failed", error: "フォルダーが見つかりません" });

        await waitFor(() =>
          expect(getErrorToastMessage(store)).toBe(
            "スキャンできませんでした（フォルダーが見つかりません）",
          ),
        );
        expect(screen.queryByText(/^スキャン完了/)).toBeNull();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(60_000);
        });
        expect(getErrorToastMessage(store)).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("モーダルを開いている間の終端はトーストを出さない（状態欄が知らせる）", async () => {
      const { store, source } = await startAndGetSource(
        {
          "GET /api/scan/:id": buildScanJobSnapshot({
            status: "failed",
            error: "x",
            finishedAt: "2026-01-01T00:00:01.000Z",
          }),
        },
        { modalOpen: true },
      );

      dispatch(source, { type: "failed", error: "x" });

      await waitFor(() =>
        expect(store.get(scanJobStoreAtom).getState().job?.status).toBe("failed"),
      );
      expect(store.get(toastRequestsAtom).size).toBe(0);
    });

    it("中止APIの失敗でstore.errorが立ったあとにジョブが失敗しても、失敗トーストは消えない", async () => {
      const { store, source } = await startAndGetSource(
        {
          "DELETE /api/scan/:id": () => apiError(500, "internal", "中止できませんでした"),
          "GET /api/scan/:id": buildScanJobSnapshot({
            status: "failed",
            error: "フォルダーが見つかりません",
            finishedAt: "2026-01-01T00:00:01.000Z",
          }),
        },
        { modalOpen: false },
      );
      await act(async () => {
        await store.get(scanJobStoreAtom).cancel();
      });
      await waitFor(() => expect(getErrorToastMessage(store)).toBe("中止できませんでした"));

      dispatch(source, { type: "failed", error: "フォルダーが見つかりません" });

      await waitFor(() =>
        expect(getErrorToastMessage(store)).toBe(
          "スキャンできませんでした（フォルダーが見つかりません）",
        ),
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(getErrorToastMessage(store)).toBe(
        "スキャンできませんでした（フォルダーが見つかりません）",
      );
    });

    it("完了の確定を待つあいだに新しいスキャンを始めたら、前のジョブの完了トーストは出さない", async () => {
      let releaseLast: () => void = () => {};
      const lastGate = new Promise<void>((resolve) => {
        releaseLast = resolve;
      });
      let posts = 0;
      const { store, source } = await startAndGetSource(
        {
          "POST /api/scan": () => {
            posts += 1;
            return { job: buildScanJobSnapshot({ id: `job-${posts}` }) };
          },
          "GET /api/scan/:id": buildScanJobSnapshot({
            status: "completed",
            finishedAt: "2026-01-01T00:00:01.000Z",
          }),
          "GET /api/scan/last": async () => {
            await lastGate;
            return buildScanRecord();
          },
        },
        { modalOpen: false },
      );
      dispatch(source, { type: "completed", finishedAt: "2026-01-01T00:00:01.000Z" });
      await waitFor(() =>
        expect(store.get(scanJobStoreAtom).getState().job?.status).toBe("completed"),
      );

      await act(async () => {
        await store.get(scanJobStoreAtom).start();
      });
      releaseLast();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(screen.queryByText(/^スキャン完了/)).toBeNull();
    });

    it("完了の時点でモーダルが開いていて、確定前に閉じても、完了トーストは出ず入口の点も付かない", async () => {
      localStorage.clear();
      let releaseLast: () => void = () => {};
      const lastGate = new Promise<void>((resolve) => {
        releaseLast = resolve;
      });
      const { store, source } = await startAndGetSource(
        {
          "GET /api/scan/:id": buildScanJobSnapshot({
            status: "completed",
            finishedAt: "2026-01-01T00:00:01.000Z",
          }),
          "GET /api/scan/last": async () => {
            await lastGate;
            return buildScanRecord({ updatedWorks: [UPDATED_WORK] });
          },
        },
        { modalOpen: true },
      );
      dispatch(source, { type: "completed", finishedAt: "2026-01-01T00:00:01.000Z" });
      await waitFor(() =>
        expect(store.get(scanJobStoreAtom).getState().job?.status).toBe("completed"),
      );

      act(() => store.set(activeModalAtom, null));
      releaseLast();
      await waitFor(() =>
        expect(store.get(scanEntrySeenAtom).changes).toEqual(["2026-01-01T00:00:00.000Z"]),
      );
      expect(screen.queryByText(/^スキャン完了/)).toBeNull();
      expect(store.get(toastRequestsAtom).size).toBe(0);
    });

    it("新しいスキャンを始めると、前の終端のトーストは消える", async () => {
      const { store, source } = await startAndGetSource(
        {
          "GET /api/scan/:id": buildScanJobSnapshot({
            status: "failed",
            error: "x",
            finishedAt: "2026-01-01T00:00:01.000Z",
          }),
        },
        { modalOpen: false },
      );
      dispatch(source, { type: "failed", error: "x" });
      await waitFor(() => expect(getErrorToastMessage(store)).not.toBeNull());

      await act(async () => {
        await store.get(scanJobStoreAtom).start();
      });

      await waitFor(() => expect(getErrorToastMessage(store)).toBeNull());
    });
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
