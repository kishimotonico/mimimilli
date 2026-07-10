// FullScreenPlayer の L⇄R入替・A-Bリピート UI 配線（TASK-10 / TASK-11）のコンポーネントテスト。
// jsdom は <dialog> の showModal/close を実装していないため、テスト対象に必要な分だけ差し替える。
import { createElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Provider as JotaiProvider, createStore } from "jotai";
import FullScreenPlayer from "../../src/features/player/ui/FullScreenPlayer";
import { PLAYER_CORE_INITIAL, type PlayerCoreState } from "../../src/features/player/model/atoms";
import type { Track, WorkSummary } from "../../src/entities/work/model";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

const track: Track = { title: "Track 1", file: "audio/track-1.wav" };

const work: WorkSummary = {
  id: "work-1",
  title: "Work 1",
  coverImage: null,
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

function renderPlayer(
  coreOverrides: Partial<PlayerCoreState> = {},
  handlers: Partial<{
    onSetChannelSwap: (enabled: boolean) => void;
    onSetABPoint: (point: "a" | "b") => void;
    onClearABRepeat: () => void;
  }> = {},
) {
  const store = createStore();
  const state: PlayerCoreState = {
    ...PLAYER_CORE_INITIAL,
    currentWork: work,
    tracks: [track],
    currentTrackIndex: 0,
    isPlaying: true,
    ...coreOverrides,
  };

  const onSetChannelSwap = handlers.onSetChannelSwap ?? vi.fn();
  const onSetABPoint = handlers.onSetABPoint ?? vi.fn();
  const onClearABRepeat = handlers.onClearABRepeat ?? vi.fn();

  render(
    createElement(
      JotaiProvider,
      { store },
      createElement(FullScreenPlayer, {
        state,
        onTogglePlay: vi.fn(),
        onSeek: vi.fn(),
        onSeekRelative: vi.fn(),
        onSetVolume: vi.fn(),
        onSetLoop: vi.fn(),
        onNext: vi.fn(),
        onPrev: vi.fn(),
        onSelectTrack: vi.fn(),
        onClose: vi.fn(),
        onSetChannelSwap,
        onSetABPoint,
        onClearABRepeat,
      }),
    ),
  );

  return { onSetChannelSwap, onSetABPoint, onClearABRepeat };
}

describe("FullScreenPlayer: L⇄R入替（TASK-10）", () => {
  it("トグルボタンをクリックすると onSetChannelSwap が反転値で呼ばれる", () => {
    const { onSetChannelSwap } = renderPlayer({ channelSwap: false });

    const button = screen.getByRole("button", { name: "左右チャンネル入替" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button);
    expect(onSetChannelSwap).toHaveBeenCalledWith(true);
  });

  it("channelSwap が true のとき aria-pressed が true になる（視覚状態）", () => {
    renderPlayer({ channelSwap: true });
    const button = screen.getByRole("button", { name: "左右チャンネル入替" });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
});

describe("FullScreenPlayer: A-Bリピート（TASK-11）", () => {
  it("A/B地点ボタンで onSetABPoint がそれぞれ呼ばれる", () => {
    const { onSetABPoint } = renderPlayer();

    fireEvent.click(screen.getByRole("button", { name: "A地点を設定" }));
    expect(onSetABPoint).toHaveBeenCalledWith("a");

    fireEvent.click(screen.getByRole("button", { name: "B地点を設定" }));
    expect(onSetABPoint).toHaveBeenCalledWith("b");
  });

  it("A/B未設定時は解除ボタン・時間表示・リピート中表示が出ない", () => {
    renderPlayer({ abRepeat: { a: null, b: null } });
    expect(screen.queryByRole("button", { name: "A-Bリピートを解除" })).toBeNull();
    expect(screen.queryByText("リピート中")).toBeNull();
  });

  it("A/B両方設定済みなら解除ボタンとリピート中表示が出て、クリックで onClearABRepeat が呼ばれる", () => {
    const { onClearABRepeat } = renderPlayer({ abRepeat: { a: 10, b: 20 } });

    expect(screen.getByText("リピート中")).toBeInTheDocument();
    const clearButton = screen.getByRole("button", { name: "A-Bリピートを解除" });
    fireEvent.click(clearButton);
    expect(onClearABRepeat).toHaveBeenCalled();
  });

  it("A のみ設定済みなら解除ボタンは出るがリピート中表示は出ない", () => {
    renderPlayer({ abRepeat: { a: 10, b: null } });
    expect(screen.getByRole("button", { name: "A-Bリピートを解除" })).toBeInTheDocument();
    expect(screen.queryByText("リピート中")).toBeNull();
  });
});
