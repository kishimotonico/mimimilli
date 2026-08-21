import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import NowPlayingView from "../../src/features/player/ui/NowPlayingView";
import { PLAYER_CORE_INITIAL, playerCoreAtom } from "../../src/entities/player/model/atoms";
import { NOW_PLAYING_IMMERSIVE_IDLE_MS } from "../../src/features/player/model/useImmersiveIdle";

const playerActions = {
  togglePlay: vi.fn(),
  nextTrack: vi.fn(),
  prevTrack: vi.fn(),
  seek: vi.fn(),
  seekRelative: vi.fn(),
  setVolume: vi.fn(),
  setLoop: vi.fn(),
  setChannelSwap: vi.fn(),
  setTrackIndex: vi.fn(),
  setABPoint: vi.fn(),
  setABPointAt: vi.fn(),
  clearABRepeat: vi.fn(),
};

vi.mock("../../src/features/player/model/usePlayerActions", () => ({
  usePlayerActions: () => playerActions,
}));

function baseCoreState() {
  return {
    ...PLAYER_CORE_INITIAL,
    currentTrackIndex: 0,
    currentWork: {
      id: "work-1",
      title: "Work 1",
      cover: null,
      status: "ok" as const,
      physicalPath: "/audio/work-1",
      totalDurationSec: 120,
      addedAt: "2026-01-01T00:00:00.000Z",
      errorMessage: null,
      urls: [],
      tags: [],
      trackCount: 2,
      bookmarked: false,
      lastPlayedAt: null,
    },
    tracks: [
      { id: "track-1", title: "Track 1", file: "audio/track-1.wav" },
      { id: "track-2", title: "Track 2", file: "audio/track-2.wav" },
    ],
  };
}

function renderNowPlayingImmersive() {
  const store = createStore();
  store.set(playerCoreAtom, baseCoreState());
  const { container } = render(
    <JotaiProvider store={store}>
      <NowPlayingView onOpenWork={vi.fn()} />
    </JotaiProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "没入モードにする" }));
  const miniControls = container.querySelector(".mle-nowplaying__immersive-minicontrols");
  if (!(miniControls instanceof HTMLElement)) throw new Error("mini controls not found");
  return { store, miniControls };
}

describe("没入モードのミニコントロールのidleフェード", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("無操作が既定時間続くとフェードし、マウス操作で復帰する", () => {
    vi.useFakeTimers();
    const { miniControls } = renderNowPlayingImmersive();

    expect(miniControls).not.toHaveClass("is-idle");

    act(() => {
      vi.advanceTimersByTime(NOW_PLAYING_IMMERSIVE_IDLE_MS + 100);
    });
    expect(miniControls).toHaveClass("is-idle");
    expect(miniControls).toHaveAttribute("aria-hidden", "true");

    act(() => {
      fireEvent.mouseMove(window);
    });
    expect(miniControls).not.toHaveClass("is-idle");
  });

  it("トラック切替では再表示されない（切替アイコン・タイトルとは異なるreset規則）", () => {
    vi.useFakeTimers();
    const { store, miniControls } = renderNowPlayingImmersive();
    const toggle = screen.getByRole("button", { name: "通常表示に戻す" });

    act(() => {
      vi.advanceTimersByTime(NOW_PLAYING_IMMERSIVE_IDLE_MS + 100);
    });
    expect(miniControls).toHaveClass("is-idle");
    expect(toggle).toHaveClass("is-idle");

    act(() => {
      store.set(playerCoreAtom, { ...baseCoreState(), currentTrackIndex: 1 });
    });

    // 切替アイコン・タイトルはトラック切替で再表示されるが、ミニコントロールは対象外。
    expect(toggle).not.toHaveClass("is-idle");
    expect(miniControls).toHaveClass("is-idle");
  });
});
