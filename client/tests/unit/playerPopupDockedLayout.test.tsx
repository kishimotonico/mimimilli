import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("ResizeObserverの実測高さ（border-box）がplayerPopupMeasuredHeightAtomへ反映される", () => {
    const store = renderPopup();
    const popupEl = screen.getByRole("slider", { name: "再生位置" }).closest(".mle-popup");
    expect(popupEl).not.toBeNull();

    // contentRect（padding/borderを含まない）ではなく offsetHeight（border-box）を
    // 読んでいることを確認する。実際のポップアップは padding:14px + border:1px を持つため、
    // 両者を混同すると実占有高さより過小に測ってしまう（過去に発生した回帰）。
    Object.defineProperty(popupEl as HTMLElement, "offsetHeight", {
      configurable: true,
      value: 542,
    });
    flushAllResizeObservers();

    expect(store.get(playerPopupMeasuredHeightAtom)).toBe(542);
  });

  it("オフセットが原点のときplayerPopupAtOriginAtomはtrue、動かすとfalseになる", () => {
    const store = renderPopup();
    expect(store.get(playerPopupAtOriginAtom)).toBe(true);

    store.set(playerPopupOffsetAtom, { x: 40, y: -20 });
    expect(store.get(playerPopupAtOriginAtom)).toBe(false);
  });

  it("マウント後にbarからpopupへ切り替えても実測高さが反映される", () => {
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
    // uiModeはマウント時点でデフォルトの"bar"のまま。
    render(
      <JotaiProvider store={store}>
        <LibraryNavigationProvider>
          <PlayerDock {...buildPlayerDockProps()} />
        </LibraryNavigationProvider>
      </JotaiProvider>,
    );

    act(() => {
      store.set(playerUiModeAtom, "popup");
    });
    const popupEl = document.querySelector(".mle-popup");
    expect(popupEl).not.toBeNull();
    Object.defineProperty(popupEl as HTMLElement, "offsetHeight", {
      configurable: true,
      value: 512,
    });
    flushAllResizeObservers();

    expect(store.get(playerPopupMeasuredHeightAtom)).toBe(512);
  });

  it("バー表示中に「バーを展開」を実クリックしても実測高さが反映される", () => {
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
    // uiModeはマウント時点でデフォルトの"bar"のまま。store.setではなく実際の
    // 「バーを展開」ボタンクリックで切り替える（switchUiModeのswitching状態も経由する）。
    render(
      <JotaiProvider store={store}>
        <LibraryNavigationProvider>
          <PlayerDock {...buildPlayerDockProps()} />
        </LibraryNavigationProvider>
      </JotaiProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /展開/ }));
    });

    const popupEl = document.querySelector(".mle-popup");
    expect(popupEl).not.toBeNull();
    Object.defineProperty(popupEl as HTMLElement, "offsetHeight", {
      configurable: true,
      value: 512,
    });
    flushAllResizeObservers();

    expect(store.get(playerPopupMeasuredHeightAtom)).toBe(512);
  });
});
