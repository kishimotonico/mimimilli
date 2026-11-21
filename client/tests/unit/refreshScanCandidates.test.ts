import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { ScanCandidate, ScanCandidatesResponse } from "@mimimilli/shared";
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
  return queryClient.getQueryData<ScanCandidatesResponse>(SCAN_CANDIDATES_QUERY_KEY)?.candidates;
}

describe("fetchScanCandidates", () => {
  it("サーバーから候補一覧を取得する", async () => {
    mockApi({
      "GET /api/scan/candidates": { scanCompleted: true, candidates: [candidateA, candidateB] },
    });

    await expect(fetchScanCandidates()).resolves.toEqual({
      scanCompleted: true,
      candidates: [candidateA, candidateB],
    });
  });
});

describe("refreshScanCandidates", () => {
  it("取得結果をクエリキャッシュへ反映する", async () => {
    mockApi({
      "GET /api/scan/candidates": { scanCompleted: true, candidates: [candidateA, candidateB] },
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const result = await refreshScanCandidates(queryClient);

    expect(result.candidates).toEqual([candidateA, candidateB]);
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
          return { scanCompleted: true, candidates: [candidateA] };
        }
        return { scanCompleted: true, candidates: [candidateB] };
      },
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const first = refreshScanCandidates(queryClient);
    const second = refreshScanCandidates(queryClient);
    firstRelease();

    const secondResult = await second;
    expect((await first).candidates).toEqual([candidateB]);

    expect(callCount).toBe(2);
    expect(secondResult.candidates).toEqual([candidateB]);
    expect(readCache(queryClient)).toEqual([candidateB]);
  });

  it("キャッシュの破棄で打ち切られたら再フェッチせずに投げる", async () => {
    let callCount = 0;
    mockApi({
      "GET /api/scan/candidates": async () => {
        callCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { scanCompleted: true, candidates: [candidateA] };
      },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const refresh = refreshScanCandidates(queryClient);
    await new Promise((resolve) => setTimeout(resolve, 0));
    queryClient.removeQueries({ queryKey: SCAN_CANDIDATES_QUERY_KEY });
    await expect(refresh).rejects.toThrow();
    expect(callCount).toBe(1);
  });

  it("取得の実行中にRJコードを直した行を差し替えても、遅れて返った古い応答で巻き戻らず、待っていた側は直した後の取得を待つ", async () => {
    const original = { ...candidateA, rjCode: "RJ000001" };
    const fixed = { ...candidateA, rjCode: "RJ000002", rjCodeEdited: true };
    const firstGate = Promise.withResolvers<void>();
    const secondGate = Promise.withResolvers<void>();
    let callCount = 0;
    mockApi({
      "GET /api/scan/candidates": async () => {
        callCount += 1;
        if (callCount === 1) {
          await firstGate.promise;
          return { scanCompleted: true, candidates: [original, candidateB] };
        }
        await secondGate.promise;
        return { scanCompleted: true, candidates: [fixed, candidateB] };
      },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(SCAN_CANDIDATES_QUERY_KEY, {
      scanCompleted: true,
      candidates: [original, candidateB],
    });

    const first = refreshScanCandidates(queryClient);
    let firstSettled = false;
    void first.then(() => (firstSettled = true));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = refreshScanCandidates(queryClient, { replace: fixed });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(readCache(queryClient)).toEqual([fixed, candidateB]);

    firstGate.resolve();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(readCache(queryClient)).toEqual([fixed, candidateB]);
    expect(firstSettled).toBe(false);

    secondGate.resolve();
    expect((await second).candidates).toEqual([fixed, candidateB]);
    expect((await first).candidates).toEqual([fixed, candidateB]);
    expect(callCount).toBe(2);
    expect(readCache(queryClient)).toEqual([fixed, candidateB]);
  });
});
