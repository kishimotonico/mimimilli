// StrictModeの開発時二重effectでDLsite attach等の離脱側後処理が二重発火しないこと、
// 同一マウント中にepochが複数回進めば取りこぼさず複数回処理されることを縛る。
import { act, createElement, StrictMode } from "react";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReconfigurationExitEffect from "../../src/app/ReconfigurationExitEffect";
import { reconfigurationExitEpochAtom } from "../../src/entities/settings/reconfigurationExitAtom";
import { dlsiteBulkActionsAtom } from "../../src/entities/dlsite/model/bulkAtoms";
import * as scanApi from "../../src/features/scan/api";

const EMPTY_SCAN_RESULT = {
  registered: 0,
  insertedWorkIds: ["work-1"] as string[],
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

function setup() {
  const getLastScanResult = vi.spyOn(scanApi, "getLastScanResult").mockResolvedValue({
    result: EMPTY_SCAN_RESULT,
    finishedAt: "2026-01-01T00:00:00.000Z",
  });
  const attach = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const store = createStore();
  store.set(dlsiteBulkActionsAtom, { start: vi.fn(), attach, cancel: vi.fn() });
  return { getLastScanResult, attach, queryClient, store };
}

describe("ReconfigurationExitEffect", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("StrictModeの二重effectでも1epochにつき1回だけ処理する", async () => {
    const { getLastScanResult, attach, queryClient, store } = setup();
    store.set(reconfigurationExitEpochAtom, 1);

    render(
      createElement(
        StrictMode,
        null,
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(JotaiProvider, { store }, createElement(ReconfigurationExitEffect)),
        ),
      ),
    );

    await vi.waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(getLastScanResult).toHaveBeenCalledTimes(1);
  });

  it("同一マウント中に2回epochが進むと2回処理される（取りこぼさない）", async () => {
    const { getLastScanResult, attach, queryClient, store } = setup();

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(JotaiProvider, { store }, createElement(ReconfigurationExitEffect)),
      ),
    );

    act(() => store.set(reconfigurationExitEpochAtom, 1));
    await vi.waitFor(() => expect(attach).toHaveBeenCalledTimes(1));

    act(() => store.set(reconfigurationExitEpochAtom, 2));
    await vi.waitFor(() => expect(attach).toHaveBeenCalledTimes(2));

    expect(getLastScanResult).toHaveBeenCalledTimes(2);
  });
});
