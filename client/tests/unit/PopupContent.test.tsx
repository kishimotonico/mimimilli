import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PopupContent from "../../src/features/player/ui/PopupContent";
import {
  PLAYER_CORE_INITIAL,
  playerCurrentTimeAtom,
  playerDurationAtom,
} from "../../src/entities/player/model/atoms";
import { Provider as JotaiProvider, createStore } from "jotai";
import type { PlayerState } from "../../src/features/player/model/usePlayerState";
import type { Track } from "../../src/entities/work/model";

const track: Track = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Track 1",
  file: "audio/track-1.wav",
};

const track2: Track = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  title: "Track 2",
  file: "audio/track-2.wav",
};

const track3: Track = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  title: "Track 3",
  file: "audio/track-3.wav",
};

function buildState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    ...PLAYER_CORE_INITIAL,
    isPlaying: false,
    isFilePlayback: true,
    tracks: [track],
    currentTrackIndex: 0,
    volume: 50,
    ...overrides,
  };
}

function renderPopup(
  overrides: Partial<PlayerState> = {},
  propOverrides: Record<string, unknown> = {},
) {
  const store = createStore();
  store.set(playerCurrentTimeAtom, 0);
  store.set(playerDurationAtom, 100);

  const handlers = {
    onTogglePlay: vi.fn(),
    onSeek: vi.fn(),
    onSeekRelative: vi.fn(),
    onSetVolume: vi.fn(),
    onSetLoop: vi.fn(),
    onSetPlaybackRate: vi.fn(),
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onFold: vi.fn(),
    onOpenNowPlaying: vi.fn(),
    onShowPlayingWork: vi.fn(),
    onStop: vi.fn(),
  };

  render(
    createElement(
      JotaiProvider,
      { store },
      createElement(PopupContent, {
        state: buildState(overrides),
        ...handlers,
        ...propOverrides,
      }),
    ),
  );
  return handlers;
}

describe("PopupContent", () => {
  it("ミュートボタンは存在しない", () => {
    renderPopup();
    expect(screen.queryByRole("button", { name: /ミュート/ })).not.toBeInTheDocument();
  });

  it("再生/一時停止ボタンでonTogglePlayを呼ぶ", () => {
    const handlers = renderPopup({ isPlaying: false });
    fireEvent.click(screen.getByRole("button", { name: "再生" }));
    expect(handlers.onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it("前後トラックボタンでonPrev/onNextを呼ぶ", () => {
    const handlers = renderPopup({ tracks: [track, track2, track3], currentTrackIndex: 1 });
    fireEvent.click(screen.getByRole("button", { name: "前のトラック" }));
    fireEvent.click(screen.getByRole("button", { name: "次のトラック" }));
    expect(handlers.onPrev).toHaveBeenCalledTimes(1);
    expect(handlers.onNext).toHaveBeenCalledTimes(1);
  });

  it("先頭/末尾トラックでは前後ボタンが無効になる", () => {
    renderPopup({ tracks: [track, track2, track3], currentTrackIndex: 0 });
    expect(screen.getByRole("button", { name: "前のトラック" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "次のトラック" })).not.toBeDisabled();
  });

  it("ループボタンでonSetLoopをトグルする", () => {
    const handlers = renderPopup({ loop: false });
    fireEvent.click(screen.getByRole("button", { name: "ループ" }));
    expect(handlers.onSetLoop).toHaveBeenCalledWith(true);
  });

  it("±10秒ボタンでonSeekRelativeを呼ぶ", () => {
    const handlers = renderPopup();
    fireEvent.click(screen.getByTitle("10秒戻る"));
    fireEvent.click(screen.getByTitle("10秒進む"));
    expect(handlers.onSeekRelative).toHaveBeenCalledWith(-10);
    expect(handlers.onSeekRelative).toHaveBeenCalledWith(10);
  });

  it("音量スライダーでonSetVolumeを呼ぶ", () => {
    const handlers = renderPopup({ volume: 50 });
    const range = document.querySelector(".mle-popup__volrange") as HTMLInputElement;
    fireEvent.change(range, { target: { value: "80" } });
    expect(handlers.onSetVolume).toHaveBeenCalledWith(80);
  });

  it("再生速度ピルでメニューを開き選択できる", () => {
    const handlers = renderPopup({ playbackRate: 1 });
    fireEvent.click(screen.getByTitle("再生速度"));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "1.5×" }));
    expect(handlers.onSetPlaybackRate).toHaveBeenCalledWith(1.5);
  });

  it("再生速度メニューはスクロールで閉じる", () => {
    renderPopup({ playbackRate: 1 });
    fireEvent.click(screen.getByTitle("再生速度"));
    expect(screen.getByRole("menu", { name: "再生速度" })).toBeInTheDocument();

    fireEvent.scroll(window);
    expect(screen.queryByRole("menu", { name: "再生速度" })).not.toBeInTheDocument();
  });

  it("再生速度メニューはフォーカスが外へ移ると閉じる", () => {
    renderPopup({ playbackRate: 1 });
    fireEvent.click(screen.getByTitle("再生速度"));
    expect(screen.getByRole("menu", { name: "再生速度" })).toBeInTheDocument();

    fireEvent.focusOut(screen.getByTitle("再生速度"), { relatedTarget: document.body });
    expect(screen.queryByRole("menu", { name: "再生速度" })).not.toBeInTheDocument();
  });

  it("停止ボタンでonStopを、バーへ戻るでonFoldを、再生中タブ表示でonOpenNowPlayingを呼ぶ", () => {
    const handlers = renderPopup();
    fireEvent.click(screen.getByRole("button", { name: "再生を停止" }));
    fireEvent.click(screen.getByRole("button", { name: "バーへ戻る" }));
    fireEvent.click(screen.getByRole("button", { name: "再生中タブを表示" }));
    expect(handlers.onStop).toHaveBeenCalledTimes(1);
    expect(handlers.onFold).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenNowPlaying).toHaveBeenCalledTimes(1);
  });
});
