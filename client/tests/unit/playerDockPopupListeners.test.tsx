import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlayerDock from "../../src/features/player/ui/PlayerDock";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { playerCoreAtom, playerUiModeAtom } from "../../src/entities/player/model/atoms";
import { PLAYER_CORE_INITIAL } from "../../src/features/player/model/playerController";

// PopupContent はモックしない: 再生速度メニューの window リスナーが
// 退出中（useIsPresent() === false）に解除されることを実物のコンポーネントで検証する。
vi.mock("../../src/features/player/ui/BarContent", () => ({
  default: ({ onSwitchToPopup }: { onSwitchToPopup: () => void }) => (
    <button type="button" onClick={onSwitchToPopup}>
      ポップアップへ
    </button>
  ),
}));

vi.mock("../../src/features/player/model/usePlayerActions", () => ({
  usePlayerActions: () => ({
    togglePlay: vi.fn(),
    nextTrack: vi.fn(),
    prevTrack: vi.fn(),
    seek: vi.fn(),
    seekRelative: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
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
        <PlayerDock />
      </LibraryNavigationProvider>
    </JotaiProvider>,
  );
}

describe("PlayerDock popup: 再生速度メニューの window リスナー", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("退出開始（useIsPresent()===false）と同時に pointerdown/keydown リスナーが解除される", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    renderPlayerDock();
    fireEvent.click(screen.getByTitle("再生速度"));

    expect(addSpy.mock.calls.some(([type]) => type === "pointerdown")).toBe(true);
    expect(addSpy.mock.calls.some(([type]) => type === "keydown")).toBe(true);
    const removedBefore = removeSpy.mock.calls.filter(
      ([type]) => type === "pointerdown" || type === "keydown",
    ).length;

    // バーへ戻る => popup 境界が退出開始。isPresent は退出開始と同時に false になるため、
    // アニメーション完了を待たずにここでリスナーが外れているはず。
    fireEvent.click(screen.getByRole("button", { name: "バーへ戻る" }));

    const removedAfter = removeSpy.mock.calls.filter(
      ([type]) => type === "pointerdown" || type === "keydown",
    ).length;
    expect(removedAfter).toBeGreaterThan(removedBefore);

    // 退出中に外部から pointerdown/keydown を飛ばしても、もはや古いリスナーには届かない
    // （そのため rateMenuOpen が再オープンされたりせずクラッシュもしない）ことを確認する。
    expect(() => {
      fireEvent.pointerDown(document.body);
      fireEvent.keyDown(window, { key: "Escape" });
    }).not.toThrow();
  });
});
