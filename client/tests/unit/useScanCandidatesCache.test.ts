import { createElement } from "react";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import { updateScanCandidatesCache } from "../../src/entities/scan/scanCandidatesCache";
import {
  syncScanCandidatesFromLast,
  useUnregisteredCandidateCount,
} from "../../src/features/scan/model/useScanCandidatesCache";

const candidateA = {
  path: "候補A" as const,
  inferredTitle: "候補A",
  audioFileCount: 1,
  audioBreakdown: [{ extension: "wav", count: 1 }],
  rjCode: null,
};

const candidateB = {
  path: "候補B" as const,
  inferredTitle: "候補B",
  audioFileCount: 1,
  audioBreakdown: [{ extension: "wav", count: 1 }],
  rjCode: null,
};

const scanCandidates = [candidateA, candidateB];

const lastScanResult = {
  finishedAt: "2026-01-01T00:00:00.000Z",
  result: {
    registered: 0,
    insertedWorkIds: [] as string[],
    updatedWorkIds: [] as string[],
    errors: 0,
    missing: 0,
    rjCodeMissingCount: 0,
    skipped: 0,
    coverErrors: 0,
    identityConflicts: [],
    invalidMetaFiles: [],
    candidates: scanCandidates,
  },
};

function CountProbe() {
  const count = useUnregisteredCandidateCount();
  return createElement("span", { "data-testid": "count" }, String(count));
}

function renderCount(queryClient: QueryClient) {
  render(createElement(QueryClientProvider, { client: queryClient }, createElement(CountProbe)));
}

function registerCandidates(queryClient: QueryClient, registeredPaths: Set<string>) {
  updateScanCandidatesCache(queryClient, (previous) =>
    previous.filter((candidate) => !registeredPaths.has(candidate.path)),
  );
}

describe("syncScanCandidatesFromLast", () => {
  it("キャッシュ済み候補を優先する", () => {
    expect(syncScanCandidatesFromLast(lastScanResult, [])).toEqual([]);
  });
});

describe("useUnregisteredCandidateCount", () => {
  it("候補キャッシュの件数を返す", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), [candidateA, candidateA]);

    renderCount(queryClient);

    expect(screen.getByTestId("count")).toHaveTextContent("2");
  });

  it("setQueryData で件数が追従する", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), [candidateA]);

    renderCount(queryClient);

    act(() => {
      queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), []);
    });

    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });
});

describe("候補登録後の件数更新（TASK-351）", () => {
  it("候補B: キャッシュが undefined のときだけ last.result.candidates にフォールバックする", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.last(), lastScanResult);

    renderCount(queryClient);
    expect(screen.getByTestId("count")).toHaveTextContent("2");

    act(() => {
      queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), []);
    });
    expect(screen.getByTestId("count")).toHaveTextContent("0");

    act(() => {
      queryClient.removeQueries({ queryKey: SCAN_QUERY_KEYS.candidates() });
    });
    expect(screen.getByTestId("count")).toHaveTextContent("2");
  });

  it("候補B: 登録で空配列キャッシュが残る限りフォールバックは件数を戻さない", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.last(), lastScanResult);
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), scanCandidates);
    registerCandidates(queryClient, new Set(scanCandidates.map((candidate) => candidate.path)));

    renderCount(queryClient);
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });
});
