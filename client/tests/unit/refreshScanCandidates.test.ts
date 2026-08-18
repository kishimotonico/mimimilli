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

function createSequentialDeferredFetch(responses: ScanCandidate[][]) {
  const gates = responses.map(() => {
    let release!: () => void;
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate;
    });
    return { gate, release };
  });
  let callIndex = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (!String(input).endsWith("/scan/candidates")) {
      throw new Error(`unexpected fetch: ${String(input)}`);
    }
    const index = callIndex;
    callIndex += 1;
    await gates[index].gate;
    return jsonResponse({ candidates: responses[index] });
  });
  return { fetchMock, gates };
}

function readCache(queryClient: QueryClient): ScanCandidate[] | undefined {
  return queryClient.getQueryData(SCAN_CANDIDATES_QUERY_KEY);
}

function seedEstablishedCache(queryClient: QueryClient, candidates: ScanCandidate[]) {
  queryClient.setQueryData(SCAN_CANDIDATES_QUERY_KEY, candidates);
  queryClient.setQueryData(["scan", "candidatesIssuedSequence"], 1);
  queryClient.setQueryData(["scan", "candidatesAppliedSequence"], 1);
}

function registerAll(queryClient: QueryClient) {
  updateScanCandidatesCache(queryClient, (previous) => previous.filter(() => false));
}

function registerCandidateA(queryClient: QueryClient) {
  updateScanCandidatesCache(queryClient, (previous) =>
    previous.filter((candidate) => candidate.path !== candidateA.path),
  );
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
    seedEstablishedCache(queryClient, [candidateA, candidateB]);
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
    seedEstablishedCache(queryClient, [candidateA]);

    await refreshScanCandidates(queryClient);

    expect(readCache(queryClient)).toEqual([candidateA, candidateB]);
  });

  it("キャッシュ未確定中の登録で bootstrap 遅延応答が登録結果を上書きしない", async () => {
    const { fetchMock, gates } = createSequentialDeferredFetch([
      [candidateA, candidateB],
      [candidateB],
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const bootstrapPromise = refreshScanCandidates(queryClient);
    registerCandidateA(queryClient);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    gates[0].release();
    await bootstrapPromise;
    gates[1].release();
    await vi.waitFor(() => expect(readCache(queryClient)).toEqual([candidateB]));

    expect(readCache(queryClient)).not.toEqual([]);
    expect(readCache(queryClient)).not.toEqual([candidateA, candidateB]);
  });

  it("refresh 応答が先着しても bootstrap 遅延応答が登録結果を上書きしない", async () => {
    const { fetchMock, gates } = createSequentialDeferredFetch([
      [candidateA, candidateB],
      [candidateB],
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const bootstrapPromise = refreshScanCandidates(queryClient);
    registerCandidateA(queryClient);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    gates[1].release();
    await vi.waitFor(() => expect(readCache(queryClient)).toEqual([candidateB]));
    gates[0].release();
    await bootstrapPromise;
    await vi.waitFor(() => expect(readCache(queryClient)).toEqual([candidateB]));

    expect(readCache(queryClient)).not.toEqual([candidateA, candidateB]);
  });

  it("発行後にローカル更新が無ければサーバー応答を適用する", async () => {
    const { fetchMock, release } = createDeferredFetch([candidateA, candidateB]);
    vi.stubGlobal("fetch", fetchMock);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    seedEstablishedCache(queryClient, [candidateA]);
    registerAll(queryClient);

    const refreshPromise = refreshScanCandidates(queryClient);
    release();
    await refreshPromise;

    expect(readCache(queryClient)).toEqual([candidateA, candidateB]);
  });

  it("並行再取得は発行順で後発が優先される", async () => {
    const { fetchMock, gates } = createSequentialDeferredFetch([
      [candidateA],
      [candidateA, candidateB],
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    seedEstablishedCache(queryClient, []);

    const firstRefresh = refreshScanCandidates(queryClient);
    const secondRefresh = refreshScanCandidates(queryClient);

    gates[1].release();
    await secondRefresh;
    gates[0].release();
    await firstRefresh;

    expect(readCache(queryClient)).toEqual([candidateA, candidateB]);
  });
});
