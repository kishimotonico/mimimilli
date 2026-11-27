import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import PlayerDock from "../../src/features/player/ui/PlayerDock";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { PLAYER_CORE_INITIAL, playerCoreAtom } from "../../src/entities/player/model/atoms";
import { playerUiModeAtom } from "../../src/features/player/model/playerPresentationAtoms";
import { createSmartFolderQueryClient } from "../helpers/smartFolders";
import { buildPlayerDockProps } from "./fixtures/playerDock";

// PopupContent はモックしない: 退出中に開いていた再生速度メニューが
// 閉じることを実物のコンポーネントで検証する。
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
    <QueryClientProvider client={createSmartFolderQueryClient()}>
      <JotaiProvider store={store}>
        <LibraryNavigationProvider>
          <PlayerDock {...buildPlayerDockProps()} />
        </LibraryNavigationProvider>
      </JotaiProvider>
    </QueryClientProvider>,
  );
}

describe("PlayerDock popup: 再生速度メニューの閉じ操作", () => {
  it("表示中はEscapeで再生速度メニューが閉じる", async () => {
    renderPlayerDock();
    await userEvent.click(screen.getByTitle("再生速度"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("バーへ戻ると、開いていた再生速度メニューも閉じる", async () => {
    renderPlayerDock();
    await userEvent.click(screen.getByTitle("再生速度"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "バーへ戻る" }));

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});
