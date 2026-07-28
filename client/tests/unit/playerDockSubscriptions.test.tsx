import { act, createElement, useMemo, type ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerRuntimeProvider } from "../../src/features/player/model/PlayerRuntimeProvider";
import { usePlayerActions, usePlayerState } from "../../src/features/player/model/usePlayer";
import PlayerRuntime from "../../src/features/player/ui/PlayerRuntime";
import type { Track, WorkSummary } from "../../src/entities/work/model";

vi.mock("../../src/features/player/api", () => ({
  saveResumePosition: vi.fn(() => Promise.resolve()),
  updateLastPlayed: vi.fn(() => Promise.resolve()),
}));

let playerDockCallCount = 0;

/** PlayerDock と同様に playerCoreAtom を購読する観測境界 */
function PlayerDockObserver() {
  usePlayerState();
  playerDockCallCount += 1;
  return null;
}

class FakeAudio extends EventTarget {
  currentTime = 0;
  duration = 0;
  error: MediaError | null = null;
  playbackRate = 1;
  readyState = 0;
  private value = "";
  volume = 1;

  get src() {
    return this.value;
  }

  set src(value: string) {
    this.value = value;
  }

  play = vi.fn(() => {
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });

  pause = vi.fn(() => this.dispatchEvent(new Event("pause")));
}

const audioInstances: FakeAudio[] = [];

function latestAudio() {
  const audio = audioInstances.at(-1);
  if (!audio) throw new Error("FakeAudio was not created");
  return audio;
}

const track: Track = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  title: "Track 1",
  file: "audio/track-1.wav",
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
  trackCount: 1,
  bookmarked: false,
  lastPlayedAt: null,
};

const playActionsRef: { current: ReturnType<typeof usePlayerActions> | null } = { current: null };

function PlayActionsBridge() {
  playActionsRef.current = usePlayerActions();
  return null;
}

function renderPlayerShell() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  });
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
          createElement(PlayActionsBridge),
          createElement(PlayerRuntime),
          createElement(PlayerDockObserver),
          children,
        ),
      ),
    );
  }

  render(createElement(Wrapper));
  return { store };
}

async function waitForPlayerDockBaseline() {
  await waitFor(() => expect(playerDockCallCount).toBeGreaterThan(0));
  await act(async () => {
    playActionsRef.current?.play(work, [track]);
  });
  await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
  await act(async () => {
    await Promise.resolve();
  });
  return playerDockCallCount;
}

beforeEach(() => {
  playerDockCallCount = 0;
  playActionsRef.current = null;
  audioInstances.length = 0;
  vi.stubGlobal(
    "Audio",
    vi.fn(function FakeAudioConstructor() {
      const audio = new FakeAudio();
      audioInstances.push(audio);
      return audio;
    }) as unknown as typeof Audio,
  );
});

describe("PlayerDock subscriptions", () => {
  it("再生中の timeupdate では PlayerDock が再レンダリングされない", async () => {
    renderPlayerShell();
    const baseline = await waitForPlayerDockBaseline();

    act(() => {
      latestAudio().currentTime = 5;
      latestAudio().dispatchEvent(new Event("timeupdate"));
      latestAudio().currentTime = 10;
      latestAudio().dispatchEvent(new Event("timeupdate"));
      latestAudio().currentTime = 15;
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });

    expect(playerDockCallCount).toBe(baseline);
  });
});
