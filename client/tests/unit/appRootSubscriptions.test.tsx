import { act, createElement, useMemo, type ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore, useAtomValue } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/app/App";
import DlsiteBulkRuntime from "../../src/features/dlsite/ui/DlsiteBulkRuntime";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import { PlayerRuntimeProvider } from "../../src/features/player/model/PlayerRuntimeProvider";
import { dlsiteBulkProgressAtom } from "../../src/entities/dlsite/model/bulkAtoms";
import { librarySearchQueryAtom } from "../../src/entities/library/model/navigationAtoms";
import { playerCoreAtom } from "../../src/entities/player/model/atoms";
import { scanJobAtom } from "../../src/entities/scan/model/atoms";
import { PLAYER_CORE_INITIAL } from "../../src/features/player/model/playerController";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import type { WorkSummary } from "../../src/entities/work/model";

let appShellCallCount = 0;
let jotaiProbeRenderCount = 0;

vi.mock("../../src/app/AppShell", () => ({
  default: vi.fn(() => {
    appShellCallCount += 1;
    return null;
  }),
}));

// D: App配下のJotai購読が実際に渡された store に繋がっていることの陽性対照プローブ。
// これが無いと、下の陰性対照（store.set で再描画されないこと）は store が別物でも空振りで通ってしまう。
function JotaiSubscriptionProbe() {
  useAtomValue(playerCoreAtom);
  jotaiProbeRenderCount += 1;
  return null;
}

const scanJobStub = {
  job: null,
  error: null,
  scanning: false,
  start: vi.fn(),
  cancel: vi.fn(),
  attach: vi.fn(),
  clearError: vi.fn(),
};

vi.mock("../../src/features/scan/model/useScanJob", () => ({
  useScanJob: () => scanJobStub,
}));

const summaryDefaults = {
  rjCodeMissingCount: 0,
  fetchFailedCount: 0,
  parseErrorCount: 0,
  parseErrorAlert: false,
  unlinkedCount: 0,
};

const work: WorkSummary = {
  id: "work-1",
  title: "Work 1",
  cover: null,
  status: "ok",
  physicalPath: "/audio/work-1",
  totalDurationSec: 120,
  addedAt: "2026-01-01T00:00:00.000Z",
  errorMessage: null,
  urls: [],
  tags: [],
  trackCount: 2,
  bookmarked: false,
  lastPlayedAt: null,
};

const tracks = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    title: "Track 1",
    file: "audio/track-1.wav",
    durationSec: 60,
    durationKind: "resolved",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    title: "Track 2",
    file: "audio/track-2.wav",
    durationSec: 60,
    durationKind: "resolved",
  },
] as const;

function seedQueryCache(queryClient: QueryClient) {
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
    rootFolder: "/test-library",
    lastScanTime: null,
  });
  queryClient.setQueryData(SCAN_QUERY_KEYS.last(), {
    result: {
      registered: 0,
      newlyGenerated: 0,
      errors: 0,
      missing: 0,
      newWorkIds: [],
      rjCodeMissingCount: 0,
    },
    finishedAt: "2026-01-01T00:00:00.000Z",
  });
  queryClient.setQueryData(WORK_QUERY_KEYS.total(), 0);
  queryClient.setQueryData(WORK_QUERY_KEYS.dlsiteNotificationSummary(), summaryDefaults);
}

function createTestQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  });
  seedQueryCache(queryClient);
  return queryClient;
}

function renderApp() {
  const queryClient = createTestQueryClient();
  const store = createStore();

  function Wrapper({ children }: { children: ReactNode }) {
    const client = useMemo(() => queryClient, []);
    const jotaiStore = useMemo(() => store, []);
    return createElement(
      QueryClientProvider,
      { client },
      createElement(
        JotaiProvider,
        { store: jotaiStore },
        createElement(
          PlayerRuntimeProvider,
          null,
          createElement(DlsiteBulkRuntime),
          createElement(ScanRuntime),
          createElement(JotaiSubscriptionProbe),
          children,
        ),
      ),
    );
  }

  render(createElement(Wrapper, null, createElement(App)));
  return { queryClient, store };
}

async function waitForAppShellBaseline() {
  await waitFor(() => expect(appShellCallCount).toBeGreaterThan(0));
  await act(async () => {
    await Promise.resolve();
  });
  return appShellCallCount;
}

function playingCoreState() {
  return {
    ...PLAYER_CORE_INITIAL,
    isPlaying: true,
    currentTrackIndex: 0,
    currentPlaylistId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    currentWork: work,
    tracks: [...tracks],
  };
}

beforeEach(() => {
  appShellCallCount = 0;
  jotaiProbeRenderCount = 0;
});

describe("App root subscriptions", () => {
  describe("購読検知（陽性対照・Jotai経路）", () => {
    it("App配下のJotai購読プローブはstore.setで再描画される", async () => {
      const { store } = renderApp();
      await waitForAppShellBaseline();
      const baseline = jotaiProbeRenderCount;

      act(() => {
        store.set(playerCoreAtom, playingCoreState());
      });

      expect(jotaiProbeRenderCount).toBeGreaterThan(baseline);
    });
  });

  describe("購読検知（陽性対照・Queryルート）", () => {
    it("App が購読している state の更新では再レンダリングされる", async () => {
      const { queryClient } = renderApp();
      const baseline = await waitForAppShellBaseline();

      await act(async () => {
        queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
          rootFolder: "/changed-root",
          lastScanTime: null,
        });
      });

      await waitFor(() =>
        expect(queryClient.getQueryData(SETTINGS_QUERY_KEYS.all())?.rootFolder).toBe(
          "/changed-root",
        ),
      );
      expect(appShellCallCount).toBeGreaterThan(baseline);
    });
  });

  describe("player state", () => {
    it("音量変更で App が再レンダリングされない", async () => {
      const { store } = renderApp();
      const baseline = await waitForAppShellBaseline();

      act(() => {
        store.set(playerCoreAtom, { ...playingCoreState(), volume: 40 });
      });

      expect(appShellCallCount).toBe(baseline);
    });

    it("再生/一時停止で App が再レンダリングされない", async () => {
      const { store } = renderApp();
      await waitForAppShellBaseline();
      act(() => {
        store.set(playerCoreAtom, playingCoreState());
      });
      const baseline = appShellCallCount;

      act(() => {
        store.set(playerCoreAtom, { ...playingCoreState(), isPlaying: false });
      });

      expect(appShellCallCount).toBe(baseline);
    });

    it("トラック切替で App が再レンダリングされない", async () => {
      const { store } = renderApp();
      await waitForAppShellBaseline();
      act(() => {
        store.set(playerCoreAtom, playingCoreState());
      });
      const baseline = appShellCallCount;

      act(() => {
        store.set(playerCoreAtom, { ...playingCoreState(), currentTrackIndex: 1 });
      });

      expect(appShellCallCount).toBe(baseline);
    });
  });

  describe("notification summary", () => {
    it("summary query の更新で App が再レンダリングされない", async () => {
      const { queryClient } = renderApp();
      const baseline = await waitForAppShellBaseline();

      await act(async () => {
        queryClient.setQueryData(WORK_QUERY_KEYS.dlsiteNotificationSummary(), {
          ...summaryDefaults,
          rjCodeMissingCount: 5,
        });
      });

      await waitFor(() =>
        expect(
          queryClient.getQueryData(WORK_QUERY_KEYS.dlsiteNotificationSummary())?.rjCodeMissingCount,
        ).toBe(5),
      );
      expect(appShellCallCount).toBe(baseline);
    });
  });

  describe("library search query", () => {
    it("検索語の更新で App が再レンダリングされない", async () => {
      const { store } = renderApp();
      const baseline = await waitForAppShellBaseline();

      act(() => {
        store.set(librarySearchQueryAtom, "asmr");
      });

      expect(appShellCallCount).toBe(baseline);
    });
  });

  describe("scan job progress", () => {
    const runningJob = (
      progress: NonNullable<import("@mimimilli/shared").ScanJobSnapshot["progress"]>,
    ) => ({
      id: "job-1",
      status: "running" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: null,
      progress,
      result: null,
      error: null,
    });

    it("スキャン進捗の更新で App が再レンダリングされない", async () => {
      const { store } = renderApp();
      const baseline = await waitForAppShellBaseline();

      act(() => {
        store.set(scanJobAtom, runningJob({ phase: "walking", processed: 1, total: 10 }));
      });
      act(() => {
        store.set(scanJobAtom, runningJob({ phase: "registering", processed: 5, total: 10 }));
      });

      expect(appShellCallCount).toBe(baseline);
    });
  });

  describe("library total / last scan query", () => {
    // TASK-124: libraryTotalQuery / lastScanQuery を ScanModal・NotificationBell へ降ろした後の退行テスト。
    // trackedProps が空の観測者は無条件通知にフォールバックする（TanStack Query v5）ため、
    // App がこれらの query を直接持つと fetchStatus 等の変化だけでも再レンダリングされてしまう。
    it("ライブラリ総件数クエリの更新で App が再レンダリングされない", async () => {
      const { queryClient } = renderApp();
      const baseline = await waitForAppShellBaseline();

      await act(async () => {
        queryClient.setQueryData(WORK_QUERY_KEYS.total(), 42);
      });

      await waitFor(() => expect(queryClient.getQueryData(WORK_QUERY_KEYS.total())).toBe(42));
      expect(appShellCallCount).toBe(baseline);
    });

    it("直近スキャン結果クエリの更新で App が再レンダリングされない", async () => {
      const { queryClient } = renderApp();
      const baseline = await waitForAppShellBaseline();

      const nextResult = {
        result: {
          registered: 1,
          newlyGenerated: 1,
          errors: 0,
          missing: 0,
          newWorkIds: [],
          rjCodeMissingCount: 0,
        },
        finishedAt: "2026-01-02T00:00:00.000Z",
      };
      await act(async () => {
        queryClient.setQueryData(SCAN_QUERY_KEYS.last(), nextResult);
      });

      await waitFor(() =>
        expect(queryClient.getQueryData(SCAN_QUERY_KEYS.last())).toEqual(nextResult),
      );
      expect(appShellCallCount).toBe(baseline);
    });
  });

  describe("dlsite bulk progress", () => {
    it("DLsite 一括取得の進捗更新で App が再レンダリングされない", async () => {
      const { store } = renderApp();
      const baseline = await waitForAppShellBaseline();

      act(() => {
        store.set(dlsiteBulkProgressAtom, { processed: 1, total: 10 });
      });
      act(() => {
        store.set(dlsiteBulkProgressAtom, { processed: 7, total: 10 });
      });

      expect(appShellCallCount).toBe(baseline);
    });
  });
});
