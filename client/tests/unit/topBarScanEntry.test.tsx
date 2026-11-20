import { act, createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";
import TopBar from "../../src/app/ui/TopBar";
import { dlsiteJobStoreAtom } from "../../src/entities/dlsite/model/dlsiteJobStore";
import { scanJobStoreAtom } from "../../src/entities/scan/model/scanJobStore";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import { activeModalAtom } from "../../src/shared/model/activeModalAtom";
import { createFakeDlsiteJobStore, createFakeScanJobStore } from "../helpers/fakeJobStores";
import { mockApi, type ApiMock } from "../helpers/api";
import { appShellRoutes } from "../helpers/appShellApi";
import {
  buildScanCandidate,
  buildScanDiagnostics,
  buildScanJobSnapshot,
  buildScanRecord,
} from "../helpers/builders";
import { workspacePath } from "@mimimilli/shared";
import { seedAppMode } from "../helpers/route";

const SEEN_KEY = "mimimilli:scanEntrySeen";
const UNREADABLE_KEY = "unreadable:壊れたフォルダー";

const candidate = buildScanCandidate({ path: "未登録作品", inferredTitle: "未登録作品" });
const otherCandidate = buildScanCandidate({ path: "別の作品", inferredTitle: "別の作品" });
const unreadableDiagnostics = buildScanDiagnostics({
  unreadablePaths: [workspacePath("壊れたフォルダー")],
});

interface Seed {
  candidates?: ReturnType<typeof buildScanCandidate>[];
  diagnostics?: ReturnType<typeof buildScanDiagnostics>;
  scanJob?: ReturnType<typeof createFakeScanJobStore>;
  dlsiteJob?: ReturnType<typeof createFakeDlsiteJobStore>;
  seen?: { candidates: string[]; needsAttention: string[]; changes: string[] };
  changes?: { newCount: number; updatedCount: number };
  diagnosticsPending?: boolean;
}

function renderTopBar(seed: Seed = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  if (seed.candidates)
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), {
      scanCompleted: true,
      candidates: seed.candidates,
    });
  const updatedWorks = Array.from({ length: seed.changes?.updatedCount ?? 0 }, (_, i) => ({
    workId: `w${i}`,
    changes: [{ kind: "meta" as const }],
  }));
  queryClient.setQueryData(SCAN_QUERY_KEYS.last(), buildScanRecord({ updatedWorks }));
  queryClient.setQueryData(WORK_QUERY_KEYS.scanNewCount(), seed.changes?.newCount ?? 0);
  if (!seed.diagnosticsPending) {
    queryClient.setQueryData(
      SCAN_QUERY_KEYS.diagnostics(),
      seed.diagnostics ?? buildScanDiagnostics(),
    );
  }
  if (seed.seen) localStorage.setItem(SEEN_KEY, JSON.stringify(seed.seen));

  const store = createStore();
  seedAppMode(store, "library");
  if (seed.scanJob) store.set(scanJobStoreAtom, seed.scanJob);
  if (seed.dlsiteJob) store.set(dlsiteJobStoreAtom, seed.dlsiteJob);

  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, createElement(TopBar)),
    ),
  );
  return { queryClient, store };
}

function scanButton(name: string | RegExp = /^スキャン/) {
  return screen.getByRole("button", { name });
}

function arcRatio(): number {
  const arc = screen.getByTestId("scan-entry-ring-arc");
  const [length] = (arc.getAttribute("stroke-dasharray") ?? "").split(" ").map(Number);
  return (length ?? 0) / (2 * Math.PI * 13);
}

function ringKind(): string | null {
  return screen.getByTestId("scan-entry-ring").getAttribute("data-ring");
}

function storedSeen(): { candidates: string[]; needsAttention: string[]; changes: string[] } {
  return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "null");
}

function openScan(store: ReturnType<typeof createStore>) {
  act(() => store.set(activeModalAtom, { kind: "scan" }));
}

function closeModal(store: ReturnType<typeof createStore>) {
  act(() => store.set(activeModalAtom, null));
}

describe("TopBar のスキャン入口", () => {
  let api: ApiMock;

  beforeEach(() => {
    localStorage.clear();
    api = mockApi(
      appShellRoutes({
        "GET /api/scan/candidates": { scanCompleted: true, candidates: [candidate] },
        "GET /api/scan/diagnostics": () => new Promise(() => {}),
      }),
    );
  });

  describe("候補の取得", () => {
    it("マウント時に /scan/candidates を取得しない", async () => {
      renderTopBar({ candidates: [candidate] });

      await waitFor(() => expect(scanButton()).toBeInTheDocument());
      expect(api.requestsTo("GET /api/scan/candidates")).toHaveLength(0);
    });

    it("ウィンドウフォーカス復帰でも /scan/candidates を再取得しない", async () => {
      renderTopBar({ candidates: [candidate] });
      await waitFor(() => expect(scanButton()).toBeInTheDocument());

      await act(async () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });

      expect(api.requestsTo("GET /api/scan/candidates")).toHaveLength(0);
    });
  });

  describe("件数", () => {
    it("候補があっても名前に件数を出さない", () => {
      renderTopBar({
        candidates: [candidate],
        seen: { candidates: [candidate.path], needsAttention: [], changes: [] },
      });

      expect(scanButton("スキャン")).toBeInTheDocument();
    });

    it("新しい項目があるときも名前に件数を出さない", () => {
      renderTopBar({ candidates: [candidate, otherCandidate] });

      expect(scanButton().getAttribute("aria-label")).toBe("スキャン（新しい項目あり）");
    });
  });

  describe("進捗の輪", () => {
    it("何も動いていなければ輪を出さない", () => {
      renderTopBar();

      expect(screen.queryByTestId("scan-entry-ring")).not.toBeInTheDocument();
      expect(scanButton("スキャン")).toBeInTheDocument();
    });

    it("スキャン中は回る弧を出す", () => {
      renderTopBar({ scanJob: createFakeScanJobStore({ job: buildScanJobSnapshot() }) });

      expect(scanButton("スキャン（実行中）")).toBeInTheDocument();
      expect(ringKind()).toBe("indeterminate");
    });

    it("まとめての取得だけなら processed/total の割合の輪を出す", () => {
      renderTopBar({
        dlsiteJob: createFakeDlsiteJobStore({
          job: {
            jobId: "job-1",
            status: "running",
            codes: new Map(),
            progress: { processed: 1, total: 4 },
          },
        }),
      });

      expect(scanButton("スキャン（実行中）")).toBeInTheDocument();
      expect(ringKind()).toBe("determinate");
      expect(arcRatio()).toBeCloseTo(0.25, 5);
    });

    it("まとめての取得の開始待ちは割合0の輪を出す", () => {
      renderTopBar({ dlsiteJob: createFakeDlsiteJobStore({ starting: { total: 10 } }) });

      expect(ringKind()).toBe("determinate");
      expect(arcRatio()).toBe(0);
    });

    it("スキャン中にまとめての取得が重なっても回る弧にする", () => {
      renderTopBar({
        scanJob: createFakeScanJobStore({ job: buildScanJobSnapshot() }),
        dlsiteJob: createFakeDlsiteJobStore({ starting: { total: 10 } }),
      });

      expect(ringKind()).toBe("indeterminate");
    });
  });

  describe("新しい項目の点", () => {
    it("記憶が空で候補があれば点を出す", () => {
      renderTopBar({ candidates: [candidate] });

      expect(scanButton("スキャン（新しい項目あり）")).toBeInTheDocument();
    });

    it("輪と点は同時に出せる", () => {
      renderTopBar({
        candidates: [candidate],
        scanJob: createFakeScanJobStore({ job: buildScanJobSnapshot() }),
      });

      expect(scanButton("スキャン（実行中・新しい項目あり）")).toBeInTheDocument();
    });

    it("開くと点が消え、見た項目を記憶し、閉じたあとも点を出さない", async () => {
      const { store } = renderTopBar({ candidates: [candidate] });
      expect(scanButton("スキャン（新しい項目あり）")).toBeInTheDocument();

      openScan(store);

      await waitFor(() => expect(scanButton("スキャン")).toBeInTheDocument());
      expect(storedSeen().candidates).toEqual([candidate.path]);

      closeModal(store);

      expect(scanButton("スキャン")).toBeInTheDocument();
    });

    it("開いたままのあいだに増えた候補も見た扱いにする", async () => {
      const { store, queryClient } = renderTopBar({ candidates: [candidate] });
      openScan(store);
      await waitFor(() => expect(storedSeen().candidates).toEqual([candidate.path]));

      act(() =>
        queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), {
          scanCompleted: true,
          candidates: [candidate, otherCandidate],
        }),
      );

      await waitFor(() =>
        expect(storedSeen().candidates).toEqual([candidate.path, otherCandidate.path].sort()),
      );
      closeModal(store);
      expect(scanButton("スキャン")).toBeInTheDocument();
    });

    it("閉じたあとに新しい候補が加わると点を出す", async () => {
      const { store, queryClient } = renderTopBar({ candidates: [candidate] });
      openScan(store);
      await waitFor(() => expect(storedSeen().candidates).toEqual([candidate.path]));
      closeModal(store);

      act(() =>
        queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), {
          scanCompleted: true,
          candidates: [candidate, otherCandidate],
        }),
      );

      await waitFor(() => expect(scanButton("スキャン（新しい項目あり）")).toBeInTheDocument());
    });

    it("候補が減っただけでは点を出さない", () => {
      const { queryClient } = renderTopBar({
        candidates: [candidate, otherCandidate],
        seen: {
          candidates: [candidate.path, otherCandidate.path].sort(),
          needsAttention: [],
          changes: [],
        },
      });

      act(() =>
        queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), {
          scanCompleted: true,
          candidates: [candidate],
        }),
      );

      expect(scanButton("スキャン")).toBeInTheDocument();
    });

    it("要対応の新しい項目でも点を出す", () => {
      renderTopBar({
        candidates: [],
        diagnostics: unreadableDiagnostics,
        seen: { candidates: [], needsAttention: [], changes: [] },
      });

      expect(scanButton("スキャン（新しい項目あり）")).toBeInTheDocument();
    });

    it("見た要対応の項目には点を出さない", () => {
      renderTopBar({
        candidates: [],
        diagnostics: unreadableDiagnostics,
        seen: { candidates: [], needsAttention: [UNREADABLE_KEY], changes: [] },
      });

      expect(scanButton("スキャン")).toBeInTheDocument();
    });

    it("スキャンで変化があれば点を出し、開くと消える。変化なしのスキャンでは出さない", async () => {
      const { store } = renderTopBar({
        candidates: [],
        changes: { newCount: 2, updatedCount: 1 },
        seen: { candidates: [], needsAttention: [], changes: [] },
      });
      expect(scanButton("スキャン（新しい項目あり）")).toBeInTheDocument();

      openScan(store);
      await waitFor(() => expect(storedSeen().changes).toEqual(["2026-01-01T00:00:00.000Z"]));
      closeModal(store);
      expect(scanButton("スキャン")).toBeInTheDocument();
    });

    it("変化のなかったスキャンでは点を出さない", () => {
      renderTopBar({
        candidates: [],
        changes: { newCount: 0, updatedCount: 0 },
        seen: { candidates: [], needsAttention: [], changes: [] },
      });

      expect(scanButton("スキャン")).toBeInTheDocument();
    });

    it("壊れた記憶は空として扱う", () => {
      localStorage.setItem(SEEN_KEY, JSON.stringify({ candidates: "x" }));
      renderTopBar({ candidates: [candidate] });

      expect(scanButton("スキャン（新しい項目あり）")).toBeInTheDocument();
    });

    it("読み込み中の集合で記憶を上書きしない", async () => {
      const { store, queryClient } = renderTopBar({
        candidates: [candidate],
        diagnostics: unreadableDiagnostics,
        diagnosticsPending: true,
        seen: { candidates: [], needsAttention: [UNREADABLE_KEY], changes: [] },
      });

      openScan(store);
      await waitFor(() => expect(storedSeen().candidates).toEqual([candidate.path]));
      expect(storedSeen().needsAttention).toEqual([UNREADABLE_KEY]);

      closeModal(store);
      act(() => queryClient.setQueryData(SCAN_QUERY_KEYS.diagnostics(), buildScanDiagnostics()));

      expect(scanButton("スキャン")).toBeInTheDocument();
    });
  });
});
