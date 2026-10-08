import { createElement } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import { scanCandidateHiddenPathsAtom } from "../../src/entities/scan/model/atoms";
import { useUnregisteredCandidateCount } from "../../src/features/scan/model/useScanCandidatesCache";

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

function CountProbe() {
  const count = useUnregisteredCandidateCount();
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

describe("useUnregisteredCandidateCount", () => {
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

describe("承認・除外のローカル編集（hiddenPaths atom）", () => {
  it("承認済みpathはhiddenPathsで隠れ、キャッシュ件数自体は変わらない", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), scanCandidates);
    const store = renderCount(queryClient);
    await expectCount("2");

    act(() => {
      store.set(scanCandidateHiddenPathsAtom, new Set([candidateA.path, candidateB.path]));
    });

    await expectCount("0");
    expect(queryClient.getQueryData(SCAN_QUERY_KEYS.candidates())).toEqual(scanCandidates);
  });

  it("承認後に遅延した再取得が完了しても、hiddenPathsにより表示は巻き戻らない", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), scanCandidates);
    const store = renderCount(queryClient);
    await expectCount("2");

    // ユーザーが候補Aを承認（ローカルで即時非表示）。
    act(() => {
      store.set(scanCandidateHiddenPathsAtom, new Set([candidateA.path]));
    });
    await expectCount("1");

    // 承認前から飛んでいた遅延中の再取得が、後から解決してキャッシュへ反映される
    // （サーバー時点ではまだ承認前の状態を返している想定）。
    act(() => {
      queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), scanCandidates);
    });

    // hiddenPathsはクエリキャッシュと独立しているため、遅延応答で巻き戻らない。
    await expectCount("1");
  });

  it("取り消し（hiddenPathsから除去）で再表示される", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), scanCandidates);
    const store = renderCount(queryClient);
    await expectCount("2");

    act(() => {
      store.set(scanCandidateHiddenPathsAtom, new Set([candidateA.path]));
    });
    await expectCount("1");

    act(() => {
      store.set(scanCandidateHiddenPathsAtom, new Set());
    });
    await expectCount("2");
  });
});
