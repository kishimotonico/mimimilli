// StrictModeの開発時二重effectでDLsite attach等の離脱側後処理が二重発火しないことを縛る。
import { createElement, StrictMode } from "react";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import ReconfigurationExitEffect from "../../src/app/ReconfigurationExitEffect";
import { reconfigurationExitPendingAtom } from "../../src/entities/settings/reconfigurationExitAtom";
import { dlsiteBulkActionsAtom } from "../../src/entities/dlsite/model/bulkAtoms";
import * as scanApi from "../../src/features/scan/api";

describe("ReconfigurationExitEffect", () => {
  it("StrictModeの二重effectでもDLsite attach判定は1回だけ行う", async () => {
    const getLastScanResult = vi.spyOn(scanApi, "getLastScanResult").mockResolvedValue({
      result: {
        registered: 0,
        insertedWorkIds: ["work-1"],
        updatedWorkIds: [],
        errors: 0,
        missing: 0,
        rjCodeMissingCount: 0,
        skipped: 0,
        coverErrors: 0,
        identityConflicts: [],
        invalidMetaFiles: [],
        candidates: [],
      },
      finishedAt: "2026-01-01T00:00:00.000Z",
    });
    const attach = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const store = createStore();
    store.set(reconfigurationExitPendingAtom, true);
    store.set(dlsiteBulkActionsAtom, {
      start: vi.fn(),
      attach,
      cancel: vi.fn(),
    });

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

    await vi.waitFor(() => expect(getLastScanResult).toHaveBeenCalled());
    await vi.waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(getLastScanResult).toHaveBeenCalledTimes(1);
    expect(store.get(reconfigurationExitPendingAtom)).toBe(false);
  });
});
