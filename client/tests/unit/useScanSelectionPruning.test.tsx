import { act, createElement } from "react";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { dlsiteJobStoreAtom } from "../../src/entities/dlsite/model/dlsiteJobStore";
import { scanCandidateSelectionAtom } from "../../src/entities/scan/model/atoms";
import { SCAN_CANDIDATES_QUERY_KEY } from "../../src/entities/scan/scanCandidatesCache";
import { useScanSelectionPruning } from "../../src/features/scan/model/useScanSelectionPruning";
import {
  isRowSelected,
  selectionOverride,
} from "../../src/features/scan/model/unregisteredSelection";
import { buildScanCandidate } from "../helpers/builders";
import { createFakeDlsiteJobStore } from "../helpers/fakeJobStores";

function Probe() {
  useScanSelectionPruning();
  return null;
}

describe("useScanSelectionPruning", () => {
  it("スキャン画面を開いていなくても、失敗→取得中→失敗で自分で選んだ上書きが消える", () => {
    const failed = buildScanCandidate({
      path: "d/failed",
      rjCode: "RJ000404",
      dlsite: { state: "failed" },
    });
    const queryClient = new QueryClient();
    queryClient.setQueryData(SCAN_CANDIDATES_QUERY_KEY, {
      scanCompleted: true,
      candidates: [failed],
    });
    const store = createStore();
    const job = createFakeDlsiteJobStore();
    store.set(dlsiteJobStoreAtom, job);
    const failedRow = { candidate: failed, display: { state: "failed" as const } };
    store.set(
      scanCandidateSelectionAtom,
      new Map([[failed.path, selectionOverride(failedRow, true)]]),
    );
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(JotaiProvider, { store }, createElement(Probe)),
      ),
    );
    expect(store.get(scanCandidateSelectionAtom).size).toBe(1);

    act(() => {
      job.setState((state) => ({
        ...state,
        job: {
          jobId: "j",
          status: "running",
          codes: new Map([["RJ000404", { origin: "single", state: "fetching" }]]),
          bulk: { processed: 0, total: 0 },
        },
      }));
    });
    act(() => {
      job.setState((state) => ({ ...state, job: null }));
    });

    const selection = store.get(scanCandidateSelectionAtom);
    expect(selection.size).toBe(0);
    expect(isRowSelected(failedRow, selection)).toBe(false);
  });
});
