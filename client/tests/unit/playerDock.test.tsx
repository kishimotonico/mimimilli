import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlayerDock from "../../src/features/player/ui/PlayerDock";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { PLAYER_CORE_INITIAL, playerCoreAtom } from "../../src/entities/player/model/atoms";
import { playerUiModeAtom } from "../../src/features/player/model/playerPresentationAtoms";
import { buildPlayerDockProps } from "./fixtures/playerDock";

vi.mock("../../src/features/player/ui/BarContent", () => ({
  default: ({ onSwitchToPopup }: { onSwitchToPopup: () => void }) => (
    <button type="button" onClick={onSwitchToPopup}>
      ポップアップへ
    </button>
  ),
}));

vi.mock("../../src/features/player/ui/PopupContent", () => ({
  default: ({ onFold }: { onFold: () => void }) => (
    <button type="button" onClick={onFold}>
      バーへ
    </button>
  ),
}));

vi.mock("../../src/entities/player/model/usePlayerActions", () => ({
  usePlayerActions: () => ({
    togglePlay: vi.fn(),
    nextTrack: vi.fn(),
    prevTrack: vi.fn(),
    seek: vi.fn(),
    seekRelative: vi.fn(),
    setVolume: vi.fn(),
    setLoop: vi.fn(),
    setPlaybackRate: vi.fn(),
  }),
}));

function renderPlayerDock(uiMode: "bar" | "popup" = "bar") {
  const store = createStore();
  store.set(playerCoreAtom, {
    ...PLAYER_CORE_INITIAL,
    currentTrackIndex: 0,
    currentWork: {
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
    },
    tracks: [{ id: "track-1", title: "Track 1", file: "audio/track-1.wav" }],
  });
  store.set(playerUiModeAtom, uiMode);
  return render(
    <JotaiProvider store={store}>
      <LibraryNavigationProvider>
        <PlayerDock {...buildPlayerDockProps()} />
      </LibraryNavigationProvider>
    </JotaiProvider>,
  );
}

describe("PlayerDock: bar⇔popup切替", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("bar→popup切替で、退出アニメ完了後にpopupだけが残る", async () => {
    vi.useFakeTimers();
    renderPlayerDock("bar");
    expect(screen.getByRole("button", { name: "ポップアップへ" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ポップアップへ" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(screen.getByRole("button", { name: "バーへ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ポップアップへ" })).not.toBeInTheDocument();
  });

  it("popup→bar切替で、退出アニメ完了後にbarだけが残る", async () => {
    vi.useFakeTimers();
    renderPlayerDock("popup");

    fireEvent.click(screen.getByRole("button", { name: "バーへ" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(screen.getByRole("button", { name: "ポップアップへ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "バーへ" })).not.toBeInTheDocument();
  });

  it("切替アニメの途中で折り返しても、最終的に折り返し先の1つだけが残る", async () => {
    vi.useFakeTimers();
    renderPlayerDock("bar");

    fireEvent.click(screen.getByRole("button", { name: "ポップアップへ" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30);
    });
    fireEvent.click(screen.getByRole("button", { name: "バーへ" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "ポップアップへ" })).toBeInTheDocument();
  });
});
