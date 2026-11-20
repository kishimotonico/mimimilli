import { act, createElement, Fragment, useMemo } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DlsiteJobRuntime from "../../src/features/dlsite/ui/DlsiteJobRuntime";
import GlobalToast from "../../src/app/ui/GlobalToast";
import {
  createDlsiteJobStore,
  dlsiteJobStoreAtom,
} from "../../src/entities/dlsite/model/dlsiteJobStore";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { mockApi } from "../helpers/api";
import { createFakeDlsiteJobStore } from "../helpers/fakeJobStores";

function renderRuntime() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const store = createStore();
  const dlsiteJob = createFakeDlsiteJobStore();
  store.set(dlsiteJobStoreAtom, dlsiteJob);
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");

  function Wrapper() {
    const client = useMemo(() => queryClient, []);
    const jotaiStore = useMemo(() => store, []);
    return createElement(
      QueryClientProvider,
      { client },
      createElement(
        JotaiProvider,
        { store: jotaiStore },
        createElement(Fragment, null, createElement(DlsiteJobRuntime), createElement(GlobalToast)),
      ),
    );
  }
  const view = render(createElement(Wrapper));
  return { queryClient, dlsiteJob, invalidate, ...view };
}

const detail = (id: string, rjCode: string | null) => ({ id, dlsite: { rjCode } });

describe("DlsiteJobRuntime", () => {
  let candidateRequests = 0;
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});
    candidateRequests = 0;
    mockApi({
      "GET /api/scan/candidates": () => {
        candidateRequests += 1;
        return { scanCompleted: true, candidates: [] };
      },
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("マウントで attach し、アンマウントで reset する", () => {
    const { dlsiteJob, unmount } = renderRuntime();
    expect(dlsiteJob.attach).toHaveBeenCalledTimes(1);
    unmount();
    expect(dlsiteJob.reset).toHaveBeenCalledTimes(1);
  });

  const settledEvent = (
    codes: Array<{ code: string; origin: "bulk" | "single"; known?: boolean }>,
  ): Parameters<ReturnType<typeof createFakeDlsiteJobStore>["emit"]>[0] => ({
    type: "codesSettled",
    codes: codes.map(({ known = true, ...rest }) => ({ ...rest, known })),
  });

  it("起点がsingleのコードが終端すると、ジョブの終端を待たず同じRJコードの作品を無効化する", async () => {
    const { dlsiteJob, queryClient } = renderRuntime();
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w1"), detail("w1", "RJ000001"));
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w2"), detail("w2", "RJ999999"));
    await act(async () => {});
    act(() => dlsiteJob.emit(settledEvent([{ code: "RJ000001", origin: "single" }])));
    await waitFor(() =>
      expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("w1"))?.isInvalidated).toBe(true),
    );
    expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("w2"))?.isInvalidated).toBe(false);
  });

  it("起点がbulkのコードは、ジョブの終わりまで作品を無効化せず、終わりでまとめて無効化する", async () => {
    const { dlsiteJob, queryClient } = renderRuntime();
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w1"), detail("w1", "rj000001"));
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w2"), detail("w2", "RJ999999"));
    queryClient.setQueryData(WORK_QUERY_KEYS.list({ q: "" }), { items: [] });
    await act(async () => {});
    act(() => dlsiteJob.emit(settledEvent([{ code: "RJ000001", origin: "bulk" }])));
    await act(async () => {});
    expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("w1"))?.isInvalidated).toBe(false);
    act(() => dlsiteJob.emit({ type: "jobEnded", jobId: "job-1" }));
    await waitFor(() =>
      expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("w1"))?.isInvalidated).toBe(true),
    );
    expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("w2"))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(WORK_QUERY_KEYS.list({ q: "" }))?.isInvalidated).toBe(true);
  });

  it("ジョブの終端では候補一覧を取り直さない", async () => {
    const { dlsiteJob } = renderRuntime();
    await act(async () => {});
    const baseline = candidateRequests;
    act(() => dlsiteJob.emit(settledEvent([{ code: "RJ000001", origin: "bulk" }])));
    act(() => dlsiteJob.emit({ type: "jobEnded", jobId: "job-1" }));
    await act(async () => {});
    expect(candidateRequests).toBe(baseline);
  });

  it("結果が不明なコードは、起点ごとの無効化に加えて候補一覧を1回取り直す", async () => {
    const { dlsiteJob, queryClient } = renderRuntime();
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w1"), detail("w1", "RJ000001"));
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w2"), detail("w2", "RJ000002"));
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w3"), detail("w3", "RJ999999"));
    await act(async () => {});
    const baseline = candidateRequests;
    act(() =>
      dlsiteJob.emit(
        settledEvent([
          { code: "RJ000001", origin: "single", known: false },
          { code: "RJ000002", origin: "bulk", known: false },
        ]),
      ),
    );
    act(() => dlsiteJob.emit({ type: "jobEnded", jobId: "job-1" }));
    await waitFor(() => expect(candidateRequests - baseline).toBe(1));
    await waitFor(() => {
      expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("w1"))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("w2"))?.isInvalidated).toBe(true);
    });
    expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("w3"))?.isInvalidated).toBe(false);
  });

  it("error をトーストに出し、閉じると clearError を呼ぶ", async () => {
    const { dlsiteJob } = renderRuntime();
    act(() => dlsiteJob.setState((state) => ({ ...state, error: "進捗を受け取れません" })));
    await waitFor(() => expect(screen.getByText("進捗を受け取れません")).toBeInTheDocument());
  });

  it("実ストアとつなぐと、アンマウントで追跡中の接続を閉じる", async () => {
    const closes: boolean[] = [];
    const source = new EventTarget() as unknown as EventSource;
    const store = createDlsiteJobStore({
      startJob: vi.fn(),
      cancelBulk: vi.fn(),
      getCurrent: vi.fn(async () => ({
        revision: 5,
        job: {
          jobId: "job-1",
          status: "running" as const,
          codes: [],
          bulk: { processed: 0, total: 0 },
        },
      })),
      connect: () => ({ source, close: () => closes.push(true) }),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const jotai = createStore();
    jotai.set(dlsiteJobStoreAtom, store);
    const view = render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(JotaiProvider, { store: jotai }, createElement(DlsiteJobRuntime)),
      ),
    );
    await waitFor(() => expect(store.getState().job?.jobId).toBe("job-1"));
    expect(closes).toHaveLength(0);
    view.unmount();
    expect(closes.length).toBeGreaterThan(0);
    expect(store.getState().job).toBeNull();
  });
});

describe("DlsiteJobRuntime と実ストア", () => {
  it("再接続のスナップショットで単発の終端を知っても、同じRJコードの作品の詳細を無効化する", async () => {
    mockApi({ "GET /api/scan/candidates": () => ({ scanCompleted: true, candidates: [] }) });
    const source = new EventTarget() as unknown as EventSource;
    const running = (revision: number) => ({
      revision,
      job: {
        jobId: "job-1",
        status: "running" as const,
        codes: [
          {
            productCode: "RJ000001",
            origin: "single" as const,
            state: "fetched" as const,
            revision,
            dlsite: { state: "fetched" as const, title: "題", cover: null },
          },
        ],
        bulk: { processed: 0, total: 0 },
      },
    });
    const store = createDlsiteJobStore({
      startJob: vi.fn(),
      cancelBulk: vi.fn(),
      getCurrent: vi.fn(async () => running(30)),
      connect: () => ({ source, close: () => {} }),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w1"), detail("w1", "RJ000001"));
    const jotai = createStore();
    jotai.set(dlsiteJobStoreAtom, store);
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(JotaiProvider, { store: jotai }, createElement(DlsiteJobRuntime)),
      ),
    );
    await waitFor(() => expect(store.getState().revision).toBe(30));
    expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("w1"))?.isInvalidated).toBe(false);

    const snapshotEvent = new MessageEvent("snapshot", {
      data: JSON.stringify({ type: "snapshot", ...running(42) }),
    });
    act(() => source.dispatchEvent(snapshotEvent));
    await waitFor(() =>
      expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("w1"))?.isInvalidated).toBe(true),
    );
  });
});
