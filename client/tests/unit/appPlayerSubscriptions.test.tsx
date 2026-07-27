import { act, createElement, useMemo, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore, useAtomValue } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerRuntimeProvider } from "../../src/features/player/model/PlayerRuntimeProvider";
import {
  playerCoreAtom,
  playerIsActiveAtom,
  playingTrackTitleAtom,
} from "../../src/features/player/model/atoms";
import { PLAYER_CORE_INITIAL } from "../../src/features/player/model/playerController";
import { usePlayerActions, usePlayerState } from "../../src/features/player/model/usePlayer";
import PlayerRuntime from "../../src/features/player/ui/PlayerRuntime";
import type { WorkSummary } from "../../src/entities/work/model";

vi.mock("../../src/features/player/api", () => ({
  saveResumePosition: vi.fn(() => Promise.resolve()),
  updateLastPlayed: vi.fn(() => Promise.resolve()),
}));

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

const track = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  title: "Track 1",
  file: "audio/track-1.wav",
};

let appRenderCount = 0;
let topBarRenderCount = 0;
let leftNavRenderCount = 0;

function TopBarLike() {
  topBarRenderCount += 1;
  useAtomValue(playerIsActiveAtom);
  useAtomValue(playingTrackTitleAtom);
  return null;
}

function LeftNavLike() {
  leftNavRenderCount += 1;
  const playingCount = useAtomValue(playerIsActiveAtom) ? 1 : 0;
  void playingCount;
  return null;
}

function AppLikeRoot() {
  appRenderCount += 1;
  const actions = usePlayerActions();

  return (
    <>
      <PlayerRuntime />
      <TopBarLike />
      <LeftNavLike />
      <button type="button" onClick={() => actions.setVolume(40)}>
        volume
      </button>
      <button type="button" onClick={() => actions.togglePlay()}>
        toggle
      </button>
      <button type="button" onClick={() => actions.nextTrack()}>
        next
      </button>
      <button
        type="button"
        onClick={() => actions.play(work, [track], 0, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")}
      >
        play
      </button>
    </>
  );
}

function renderHarness() {
  const queryClient = new QueryClient();
  const store = createStore();

  function Wrapper({ children }: { children: ReactNode }) {
    const client = useMemo(() => queryClient, []);
    const jotaiStore = useMemo(() => store, []);
    return createElement(
      QueryClientProvider,
      { client },
      createElement(JotaiProvider, { store: jotaiStore }, children),
    );
  }

  return render(
    createElement(
      Wrapper,
      null,
      createElement(PlayerRuntimeProvider, null, createElement(AppLikeRoot)),
    ),
  );
}

beforeEach(() => {
  appRenderCount = 0;
  topBarRenderCount = 0;
  leftNavRenderCount = 0;
  vi.stubGlobal(
    "Audio",
    vi.fn(function FakeAudioConstructor() {
      return new FakeAudio();
    }) as unknown as typeof Audio,
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("App player subscriptions", () => {
  it("音量変更で App 相当のルートが再レンダリングされない", async () => {
    renderHarness();
    const before = appRenderCount;
    await act(async () => {
      screen.getByRole("button", { name: "play" }).click();
    });
    expect(appRenderCount).toBe(before);
    await act(async () => {
      screen.getByRole("button", { name: "volume" }).click();
    });
    expect(appRenderCount).toBe(before);
  });

  it("再生/一時停止で App 相当のルートが再レンダリングされない", async () => {
    renderHarness();
    await act(async () => {
      screen.getByRole("button", { name: "play" }).click();
    });
    const afterPlay = appRenderCount;
    await act(async () => {
      screen.getByRole("button", { name: "toggle" }).click();
    });
    expect(appRenderCount).toBe(afterPlay);
  });

  it("トラック切替で App 相当のルートが再レンダリングされない", async () => {
    renderHarness();
    await act(async () => {
      screen.getByRole("button", { name: "play" }).click();
    });
    const afterPlay = appRenderCount;
    await act(async () => {
      screen.getByRole("button", { name: "next" }).click();
    });
    expect(appRenderCount).toBe(afterPlay);
  });

  it("音量変更で TopBar / LeftNav 相当の購読コンポーネントが再レンダリングされない", async () => {
    renderHarness();
    await act(async () => {
      screen.getByRole("button", { name: "play" }).click();
    });
    const topBarAfterPlay = topBarRenderCount;
    const leftNavAfterPlay = leftNavRenderCount;
    await act(async () => {
      screen.getByRole("button", { name: "volume" }).click();
    });
    expect(topBarRenderCount).toBe(topBarAfterPlay);
    expect(leftNavRenderCount).toBe(leftNavAfterPlay);
  });

  it("playerCoreAtom を App が購読していると再レンダリングされる（陽性対照）", async () => {
    function SubscribingAppLikeRoot() {
      appRenderCount += 1;
      usePlayerState();
      return createElement(PlayerRuntime);
    }

    const queryClient = new QueryClient();
    const store = createStore();

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          JotaiProvider,
          { store },
          createElement(PlayerRuntimeProvider, null, createElement(SubscribingAppLikeRoot)),
        ),
      ),
    );

    const before = appRenderCount;
    act(() => {
      store.set(playerCoreAtom, {
        ...PLAYER_CORE_INITIAL,
        volume: 10,
      });
    });
    expect(appRenderCount).toBeGreaterThan(before);
  });
});
