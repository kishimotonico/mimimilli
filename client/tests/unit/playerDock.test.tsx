import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlayerDock from "../../src/features/player/ui/PlayerDock";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { playerCoreAtom, playerUiModeAtom } from "../../src/entities/player/model/atoms";
import { PLAYER_CORE_INITIAL } from "../../src/features/player/model/playerController";

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
    setShowFullPlayer: vi.fn(),
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
        <PlayerDock />
      </LibraryNavigationProvider>
    </JotaiProvider>,
  );
}

/** .mle-bar1 / .mle-popup がDOMから取り除かれた回数を数える。
 * AnimatePresence の各境界は子を高々1つしか持たないため、この回数は
 * 両境界に共通で渡している onExitComplete（switchingUiMode解除）の呼び出し回数と一致する。 */
function countDockNodeRemovals(): { count: () => number; disconnect: () => void } {
  let count = 0;
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.removedNodes)) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(".mle-bar1, .mle-popup")) count += 1;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return { count: () => count, disconnect: () => observer.disconnect() };
}

describe("PlayerDock: bar⇔popup切替", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("bar→popup切替後、入場アニメ完了でswitching状態が解除される（initial={false}済み・再入場でenterしない）", async () => {
    vi.useFakeTimers();
    renderPlayerDock("bar");

    // 初回マウント時点で enter アニメが走っていない（skipInitial/initial={false} 相当）ことの確認。
    // 表示中の要素は data-ui-switching を持たない。
    expect(document.querySelector("[data-ui-switching]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "ポップアップへ" }));
    expect(document.querySelector("[data-ui-switching]")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(document.querySelector("[data-ui-switching]")).toBeNull();
    expect(screen.getByRole("button", { name: "バーへ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ポップアップへ" })).not.toBeInTheDocument();
  });

  it("popup→bar切替後もswitching状態が解除される", async () => {
    vi.useFakeTimers();
    renderPlayerDock("popup");

    fireEvent.click(screen.getByRole("button", { name: "バーへ" }));
    expect(document.querySelector("[data-ui-switching]")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(document.querySelector("[data-ui-switching]")).toBeNull();
    expect(screen.getByRole("button", { name: "ポップアップへ" })).toBeInTheDocument();
  });

  it("高速連続切替でも、実際に完了した退出の数だけしかswitching解除（onExitComplete相当）が発火しない", async () => {
    vi.useFakeTimers();
    renderPlayerDock("bar");
    const removals = countDockNodeRemovals();

    // bar→popup切替を開始した直後（どちらの入退場もまだ完了していない）に popup→bar へ折り返す。
    fireEvent.click(screen.getByRole("button", { name: "ポップアップへ" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30);
    });
    fireEvent.click(screen.getByRole("button", { name: "バーへ" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // bar は退出を割り込まれて再入場するため一度も unmount されない。
    // popup は退出未完了のまま折り返されて exit へ入り、そのまま退出を完了する。
    // よって完了する退出は「popup の1回」のみ。
    expect(removals.count()).toBe(1);
    removals.disconnect();

    expect(document.querySelector("[data-ui-switching]")).toBeNull();
    expect(screen.getByRole("button", { name: "ポップアップへ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "バーへ" })).not.toBeInTheDocument();
  });
});
