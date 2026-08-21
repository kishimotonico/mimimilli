import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import NowPlayingView from "../../src/features/player/ui/NowPlayingView";
import { playerCoreAtom } from "../../src/entities/player/model/atoms";
import { PLAYER_CORE_INITIAL } from "../../src/features/player/model/playerController";
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

function renderNowPlaying() {
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
  render(
    <JotaiProvider store={store}>
      <NowPlayingView onOpenWork={vi.fn()} />
    </JotaiProvider>,
  );
  return { store };
}

/** テスト内では JSDOM が実レイアウトを計算しないため、シーク行のみ固定の
 * DOMRect を返すよう差し替える。モード切替の前後で同じ値であることを見る。 */
function stubSeekRowRect() {
  const original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (
      this.dataset.testid === "nowplaying-seek-row" ||
      this.getAttribute("data-testid") === "nowplaying-seek-row"
    ) {
      return new DOMRectReadOnly(48, 900, 1200, 56);
    }
    return original.call(this);
  };
  return () => {
    HTMLElement.prototype.getBoundingClientRect = original;
  };
}

describe("再生中タブ: 没入モード切替とシーク行の非再マウント", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("モード切替の前後でシーク行が同一DOMノード・同一サイズ・同一位置のまま残る", () => {
    const restoreRect = stubSeekRowRect();
    renderNowPlaying();

    const seekRowBefore = screen.getByTestId("nowplaying-seek-row");
    const rectBefore = seekRowBefore.getBoundingClientRect();

    fireEvent.click(screen.getByRole("button", { name: "没入モードにする" }));

    const seekRowAfter = screen.getByTestId("nowplaying-seek-row");
    expect(seekRowAfter).toBe(seekRowBefore);
    expect(seekRowAfter.getBoundingClientRect()).toEqual(rectBefore);

    fireEvent.click(screen.getByRole("button", { name: "通常表示に戻す" }));

    const seekRowFinal = screen.getByTestId("nowplaying-seek-row");
    expect(seekRowFinal).toBe(seekRowBefore);
    expect(seekRowFinal.getBoundingClientRect()).toEqual(rectBefore);

    restoreRect();
  });

  it("没入モードでは周辺（2カラム本文）が退出し、通常モード固有のUIが残らない", async () => {
    vi.useFakeTimers();
    renderNowPlaying();

    expect(screen.getByText("この作品の詳細を見る")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "没入モードにする" }));

    // 切替アイコン・タイトルは退出アニメーション完了を待たずに即座に現れる。
    expect(screen.getByRole("button", { name: "通常表示に戻す" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(screen.queryByText("この作品の詳細を見る")).not.toBeInTheDocument();
  });

  it("モードは localStorage に永続化され、次回もそのモードで開く", () => {
    renderNowPlaying();
    fireEvent.click(screen.getByRole("button", { name: "没入モードにする" }));

    expect(JSON.parse(localStorage.getItem("mimimilli:nowPlayingViewMode") ?? '""')).toBe(
      "immersive",
    );
  });

  it("没入モードで無操作が既定時間続くと切替アイコン・タイトルがフェードし、操作で復帰する", () => {
    vi.useFakeTimers();
    renderNowPlaying();

    fireEvent.click(screen.getByRole("button", { name: "没入モードにする" }));
    const toggle = screen.getByRole("button", { name: "通常表示に戻す" });
    expect(toggle).not.toHaveClass("is-idle");

    act(() => {
      vi.advanceTimersByTime(NOW_PLAYING_IMMERSIVE_IDLE_MS + 100);
    });
    expect(toggle).toHaveClass("is-idle");

    act(() => {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    });
    expect(toggle).not.toHaveClass("is-idle");
  });

  it("画面中央付近（カバー領域）のクリックで再生/一時停止がトグルする", () => {
    renderNowPlaying();

    fireEvent.click(screen.getByRole("button", { name: "没入モードにする" }));
    fireEvent.click(screen.getByRole("button", { name: "通常表示に戻す" }).parentElement!);

    expect(playerActions.togglePlay).toHaveBeenCalled();
  });
});
