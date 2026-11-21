import { createElement } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { refreshScanCandidates } from "../../src/entities/scan/scanCandidatesCache";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import { useScanCandidatesState } from "../../src/features/scan/model/useScanCandidatesCache";
import { apiError, mockApi } from "../helpers/api";
import { buildScanCandidate } from "../helpers/builders";

const candidateA = buildScanCandidate({ path: "候補A", inferredTitle: "候補A" });

function Probe() {
  const { candidates, scanCompleted, status } = useScanCandidatesState();
  return createElement(
    "span",
    { "data-testid": "state" },
    `${status}:${scanCompleted}:${candidates.length}`,
  );
}

function renderProbe(queryClient: QueryClient) {
  render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)));
}

async function expectState(text: string) {
  await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent(text));
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("useScanCandidatesState", () => {
  it("キャッシュした応答の候補とスキャン完了の有無を返す", async () => {
    const queryClient = newClient();
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), {
      scanCompleted: true,
      candidates: [candidateA, candidateA],
    });

    renderProbe(queryClient);

    await expectState("loaded:true:2");
  });

  it("setQueryData で追従する", async () => {
    const queryClient = newClient();
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), {
      scanCompleted: true,
      candidates: [candidateA],
    });
    renderProbe(queryClient);
    await expectState("loaded:true:1");

    act(() => {
      queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), {
        scanCompleted: true,
        candidates: [],
      });
    });

    await expectState("loaded:true:0");
  });

  it("スキャン完了前の応答は、候補が0件でも scanCompleted が false のまま読み込み済みになる", async () => {
    const queryClient = newClient();
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), {
      scanCompleted: false,
      candidates: [],
    });

    renderProbe(queryClient);

    await expectState("loaded:false:0");
  });

  it("未取得のあいだは loading で、直近のスキャン結果から件数を補わない", async () => {
    renderProbe(newClient());

    await expectState("loading:false:0");
  });

  it("最初の取得が失敗したら error になり、取り直して成功すれば loaded になる", async () => {
    let fail = true;
    mockApi({
      "GET /api/scan/candidates": () =>
        fail
          ? apiError(500, "internal", "失敗")
          : { scanCompleted: true, candidates: [candidateA] },
    });
    const queryClient = newClient();
    renderProbe(queryClient);

    await refreshScanCandidates(queryClient).catch(() => undefined);
    await expectState("error:false:0");

    fail = false;
    await act(async () => {
      await refreshScanCandidates(queryClient);
    });
    await expectState("loaded:true:1");
  });
});
