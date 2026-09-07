import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlayerDock from "../../src/features/player/ui/PlayerDock";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { PLAYER_CORE_INITIAL, playerCoreAtom } from "../../src/entities/player/model/atoms";
import {
  playerDockPopupVisibleAtom,
  playerPopupAtOriginAtom,
  playerPopupMeasuredHeightAtom,
  playerPopupOffsetAtom,
  playerUiModeAtom,
} from "../../src/features/player/model/playerPresentationAtoms";
import { buildPlayerDockProps } from "./fixtures/playerDock";
import { clearResizeObservers, flushAllResizeObservers } from "./setup";

vi.mock("../../src/features/player/model/usePlayerActions", () => ({
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

function renderPopup() {
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
  store.set(playerUiModeAtom, "popup");
  render(
    <JotaiProvider store={store}>
      <LibraryNavigationProvider>
        <PlayerDock {...buildPlayerDockProps()} />
      </LibraryNavigationProvider>
    </JotaiProvider>,
  );
  return store;
}

describe("player popup docked layout（TASK-430）", () => {
  afterEach(() => {
    clearResizeObservers();
  });

  it("ポップアップ表示中はplayerDockPopupVisibleAtomがtrueになる", () => {
    const store = renderPopup();
    expect(store.get(playerDockPopupVisibleAtom)).toBe(true);
  });

  it("ResizeObserverの実測高さがplayerPopupMeasuredHeightAtomへ反映される", () => {
    const store = renderPopup();
    expect(screen.getByRole("slider", { name: "再生位置" })).toBeInTheDocument();

    flushAllResizeObservers({ width: 336, height: 512 });

    expect(store.get(playerPopupMeasuredHeightAtom)).toBe(512);
  });

  it("オフセットが原点のときplayerPopupAtOriginAtomはtrue、動かすとfalseになる", () => {
    const store = renderPopup();
    expect(store.get(playerPopupAtOriginAtom)).toBe(true);

    store.set(playerPopupOffsetAtom, { x: 40, y: -20 });
    expect(store.get(playerPopupAtOriginAtom)).toBe(false);
  });
});
