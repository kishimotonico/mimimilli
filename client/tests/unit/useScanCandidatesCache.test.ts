import { createElement } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import { useScanCandidatesCache } from "../../src/features/scan/model/useScanCandidatesCache";

const candidateA = {
  path: "候補A" as const,
  inferredTitle: "候補A",
  audioFileCount: 1,
  audioBreakdown: [{ extension: "wav", count: 1 }],
  rjCode: null,
};

function CountProbe() {
  const count = useScanCandidatesCache().length;
  return createElement("span", { "data-testid": "count" }, String(count));
}

function renderCount(queryClient: QueryClient, store = createStore()) {
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, createElement(CountProbe)),
    ),
  );
  return store;
}

async function expectCount(text: string) {
  await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent(text));
}

describe("useScanCandidatesCache", () => {
  it("候補キャッシュの件数を返す", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), [candidateA, candidateA]);

    renderCount(queryClient);

    await expectCount("2");
  });

  it("setQueryData で件数が追従する", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), [candidateA]);

    renderCount(queryClient);
    await expectCount("1");

    act(() => {
      queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), []);
    });

    await expectCount("0");
  });

  it("候補キャッシュが未取得のときは件数0で、直近のスキャン結果から件数を補わない", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderCount(queryClient);

    await expectCount("0");
  });
});
