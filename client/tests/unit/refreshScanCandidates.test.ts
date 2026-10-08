import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { ScanCandidate } from "@mimimilli/shared";
import {
  fetchScanCandidates,
  refreshScanCandidates,
  SCAN_CANDIDATES_QUERY_KEY,
} from "../../src/entities/scan/scanCandidatesCache";
import { mockApi } from "../helpers/api";
import { buildScanCandidate } from "../helpers/builders";

const candidateA = buildScanCandidate({
  path: "候補A",
  inferredTitle: "候補A",
  audioBreakdown: [{ extension: "wav", count: 1 }],
});

const candidateB = buildScanCandidate({
  path: "候補B",
  inferredTitle: "候補B",
  audioBreakdown: [{ extension: "wav", count: 1 }],
});

function readCache(queryClient: QueryClient): ScanCandidate[] | undefined {
  return queryClient.getQueryData(SCAN_CANDIDATES_QUERY_KEY);
}

describe("fetchScanCandidates", () => {
  it("サーバーから候補一覧を取得する", async () => {
    mockApi({ "GET /api/scan/candidates": { candidates: [candidateA, candidateB] } });

    await expect(fetchScanCandidates()).resolves.toEqual([candidateA, candidateB]);
  });
});

describe("refreshScanCandidates", () => {
  it("取得結果をクエリキャッシュへ反映する", async () => {
    mockApi({ "GET /api/scan/candidates": { candidates: [candidateA, candidateB] } });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const result = await refreshScanCandidates(queryClient);

    expect(result).toEqual([candidateA, candidateB]);
    expect(readCache(queryClient)).toEqual([candidateA, candidateB]);
  });

  it("先行リクエスト実行中に状態変更後の再取得を呼ぶと、新しいサーバー状態が反映される", async () => {
    let firstRelease!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      firstRelease = resolve;
    });

    let callCount = 0;
    mockApi({
      "GET /api/scan/candidates": async () => {
        callCount += 1;
        if (callCount === 1) {
          await firstGate;
          return { candidates: [candidateA] };
        }
        return { candidates: [candidateB] };
      },
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const first = refreshScanCandidates(queryClient);
    const second = refreshScanCandidates(queryClient);
    firstRelease();

    const secondResult = await second;
    await first;

    expect(callCount).toBe(2);
    expect(secondResult).toEqual([candidateB]);
    expect(readCache(queryClient)).toEqual([candidateB]);
  });
});
