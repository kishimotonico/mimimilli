import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanCandidate } from "@mimimilli/shared";
import {
  refreshScanCandidates,
  SCAN_CANDIDATES_QUERY_KEY,
  updateScanCandidatesCache,
} from "../../src/entities/scan/scanCandidatesCache";

const candidateA: ScanCandidate = {
  path: "候補A",
  inferredTitle: "候補A",
  audioFileCount: 1,
  audioBreakdown: [{ extension: "wav", count: 1 }],
  rjCode: null,
};

const candidateB: ScanCandidate = {
  path: "候補B",
  inferredTitle: "候補B",
  audioFileCount: 1,
  audioBreakdown: [{ extension: "wav", count: 1 }],
  rjCode: null,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function createDeferredFetch(candidates: ScanCandidate[]) {
  let release!: () => void;
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/scan/candidates")) {
      await gate;
      return jsonResponse({ candidates });
    }
    throw new Error(`unexpected fetch: ${String(input)}`);
  });
  return { fetchMock, release };
}

function readCache(queryClient: QueryClient): ScanCandidate[] | undefined {
  return queryClient.getQueryData(SCAN_CANDIDATES_QUERY_KEY);
}

function registerAll(queryClient: QueryClient) {
  updateScanCandidatesCache(queryClient, () => []);
}

describe("refreshScanCandidates", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("登録後に遅延した再取得がキャッシュを巻き戻さない", async () => {
    const { fetchMock, release } = createDeferredFetch([candidateA, candidateB]);
    vi.stubGlobal("fetch", fetchMock);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    updateScanCandidatesCache(queryClient, () => [candidateA, candidateB]);
    const refreshPromise = refreshScanCandidates(queryClient);
    registerAll(queryClient);

    release();
    await refreshPromise;

    expect(readCache(queryClient)).toEqual([]);
  });

  it("新しいスキャン完了時はサーバー応答で候補を更新する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/scan/candidates")) {
          return jsonResponse({ candidates: [candidateA, candidateB] });
        }
        throw new Error(`unexpected fetch: ${String(input)}`);
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    updateScanCandidatesCache(queryClient, () => [candidateA]);

    await refreshScanCandidates(queryClient);

    expect(readCache(queryClient)).toEqual([candidateA, candidateB]);
  });

  it("bootstrap の遅延応答は登録結果を上書きしない", async () => {
    const { fetchMock, release } = createDeferredFetch([candidateA, candidateB]);
    vi.stubGlobal("fetch", fetchMock);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const refreshPromise = refreshScanCandidates(queryClient);

    updateScanCandidatesCache(queryClient, () => [candidateA, candidateB]);
    registerAll(queryClient);

    release();
    await refreshPromise;

    expect(readCache(queryClient)).toEqual([]);
  });

  it("発行後にローカル更新が無ければサーバー応答を適用する", async () => {
    const { fetchMock, release } = createDeferredFetch([candidateA, candidateB]);
    vi.stubGlobal("fetch", fetchMock);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    updateScanCandidatesCache(queryClient, () => [candidateA]);
    registerAll(queryClient);

    const refreshPromise = refreshScanCandidates(queryClient);
    release();
    await refreshPromise;

    expect(readCache(queryClient)).toEqual([candidateA, candidateB]);
  });
});
