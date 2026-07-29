import { act, createElement, useMemo, type ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/app/App";
import { PlayerRuntimeProvider } from "../../src/features/player/model/PlayerRuntimeProvider";
import { librarySearchQueryAtom } from "../../src/features/library/model/atoms";
import { playerCoreAtom } from "../../src/features/player/model/atoms";
import { PLAYER_CORE_INITIAL } from "../../src/features/player/model/playerController";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import type { WorkSummary } from "../../src/entities/work/model";

let appShellCallCount = 0;

vi.mock("../../src/app/AppShell", () => ({
  default: vi.fn(() => {
    appShellCallCount += 1;
    return null;
  }),
}));

const scanJobStub = {
  job: null,
  error: null,
  scanning: false,
  start: vi.fn(),
  cancel: vi.fn(),
  attach: vi.fn(),
  clearError: vi.fn(),
};

vi.mock("../../src/features/scan/useScanJob", () => ({
  useScanJob: () => scanJobStub,
}));

const dlsiteBulkStub = {
  active: false,
  cancelling: false,
  progress: null,
  result: null,
  cancelledResult: null,
  error: null,
  start: vi.fn(),
  attach: vi.fn(),
  cancel: vi.fn(),
  dismiss: vi.fn(),
};

vi.mock("../../src/app/model/useDlsiteBulk", () => ({
  useDlsiteBulk: () => dlsiteBulkStub,
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
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    title: "Track 2",
    file: "audio/track-2.wav",
    durationSec: 60,
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
        createElement(PlayerRuntimeProvider, null, children),
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
});

describe("App root subscriptions", () => {
  describe("購読検知（陽性対照）", () => {
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
});
