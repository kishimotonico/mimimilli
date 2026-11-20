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
    codes: Array<{ code: string; known?: boolean }>,
  ): Parameters<ReturnType<typeof createFakeDlsiteJobStore>["emit"]>[0] => ({
    type: "codesSettled",
    codes: codes.map(({ known = true, ...rest }) => ({ ...rest, known })),
  });

  it("終端に達したコードは、ジョブの終わりまで作品を無効化せず、終わりでまとめて無効化する", async () => {
    const { dlsiteJob, queryClient } = renderRuntime();
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w1"), detail("w1", "rj000001"));
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w2"), detail("w2", "RJ999999"));
    queryClient.setQueryData(WORK_QUERY_KEYS.list({ q: "" }), { items: [] });
    await act(async () => {});
    act(() => dlsiteJob.emit(settledEvent([{ code: "RJ000001" }])));
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
    act(() => dlsiteJob.emit(settledEvent([{ code: "RJ000001" }])));
    act(() => dlsiteJob.emit({ type: "jobEnded", jobId: "job-1" }));
    await act(async () => {});
    expect(candidateRequests).toBe(baseline);
  });

  it("結果が不明なコードは、ジョブの終わりの無効化に加えて候補一覧を1回取り直す", async () => {
    const { dlsiteJob, queryClient } = renderRuntime();
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w1"), detail("w1", "RJ000001"));
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w2"), detail("w2", "RJ000002"));
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w3"), detail("w3", "RJ999999"));
    await act(async () => {});
    const baseline = candidateRequests;
    act(() =>
      dlsiteJob.emit(
        settledEvent([
          { code: "RJ000001", known: false },
          { code: "RJ000002", known: false },
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
      cancel: vi.fn(),
      getCurrent: vi.fn(async () => ({
        revision: 5,
        job: {
          jobId: "job-1",
          status: "running" as const,
          codes: [],
          progress: { processed: 0, total: 0 },
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
