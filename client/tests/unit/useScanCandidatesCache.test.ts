import { createElement } from "react";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import {
  syncScanCandidatesFromLast,
  useUnregisteredCandidateCount,
} from "../../src/features/scan/model/useScanCandidatesCache";

const candidate = {
  path: "候補" as const,
  inferredTitle: "候補",
  audioFileCount: 1,
  audioBreakdown: [{ extension: "wav", count: 1 }],
  rjCode: null,
};

function CountProbe() {
  const count = useUnregisteredCandidateCount();
  return createElement("span", { "data-testid": "count" }, String(count));
}

describe("syncScanCandidatesFromLast", () => {
  it("キャッシュ済み候補を優先する", () => {
    expect(
      syncScanCandidatesFromLast(
        {
          finishedAt: "2026-01-01T00:00:00.000Z",
          result: {
            registered: 0,
            insertedWorkIds: [],
            updatedWorkIds: [],
            errors: 0,
            missing: 0,
            rjCodeMissingCount: 0,
            skipped: 0,
            coverErrors: 0,
            identityConflicts: [],
            invalidMetaFiles: [],
            candidates: [candidate],
          },
        },
        [],
      ),
    ).toEqual([]);
  });
});

describe("useUnregisteredCandidateCount", () => {
  it("候補キャッシュの件数を返す", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), [candidate, candidate]);

    render(createElement(QueryClientProvider, { client: queryClient }, createElement(CountProbe)));

    expect(screen.getByTestId("count")).toHaveTextContent("2");
  });

  it("setQueryData で件数が追従する", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), [candidate]);

    render(createElement(QueryClientProvider, { client: queryClient }, createElement(CountProbe)));

    act(() => {
      queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), []);
    });

    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });
});
