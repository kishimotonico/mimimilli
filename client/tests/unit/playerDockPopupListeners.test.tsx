import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import PlayerDock from "../../src/features/player/ui/PlayerDock";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { PLAYER_CORE_INITIAL, playerCoreAtom } from "../../src/entities/player/model/atoms";
import { playerUiModeAtom } from "../../src/features/player/model/playerPresentationAtoms";
import { buildPlayerDockProps } from "./fixtures/playerDock";

// PopupContent はモックしない: 再生速度メニュー（usePopoverDismissal 経由）のリスナーが
// 退出中（useIsPresent() === false）に解除されることを実物のコンポーネントで検証する。
vi.mock("../../src/features/player/ui/BarContent", () => ({
  default: ({ onSwitchToPopup }: { onSwitchToPopup: () => void }) => (
    <button type="button" onClick={onSwitchToPopup}>
      ポップアップへ
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

function renderPlayerDock() {
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
  return render(
    <JotaiProvider store={store}>
      <LibraryNavigationProvider>
        <PlayerDock {...buildPlayerDockProps()} />
      </LibraryNavigationProvider>
    </JotaiProvider>,
  );
}

describe("PlayerDock popup: 再生速度メニューの閉じ操作", () => {
  it("表示中はEscapeで再生速度メニューが閉じる", () => {
    renderPlayerDock();
    fireEvent.click(screen.getByTitle("再生速度"));
    expect(screen.getByRole("menu", { name: "再生速度" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu", { name: "再生速度" })).not.toBeInTheDocument();
  });

  it("バーへ戻る退出中は、Escapeや外側クリックに再生速度メニューが反応しない", () => {
    renderPlayerDock();
    fireEvent.click(screen.getByTitle("再生速度"));
    expect(screen.getByRole("menu", { name: "再生速度" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "バーへ戻る" }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerDown(document.body);

    expect(screen.getByRole("menu", { name: "再生速度" })).toBeInTheDocument();
  });
});
