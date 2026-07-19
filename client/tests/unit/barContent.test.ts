import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import type { Track, WorkSummary } from "../../src/entities/work/model";
import { PLAYER_CORE_INITIAL, type PlayerCoreState } from "../../src/features/player/model/atoms";
import BarContent from "../../src/features/player/ui/BarContent";

const tracks: Track[] = [
  { title: "Track 1", file: "audio/track-1.wav" },
  { title: "Track 2", file: "audio/track-2.wav" },
];

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
  trackCount: tracks.length,
  bookmarked: false,
  lastPlayedAt: null,
};

function renderBar(currentTrackIndex: number) {
  const state: PlayerCoreState = {
    ...PLAYER_CORE_INITIAL,
    currentWork: work,
    tracks,
    currentTrackIndex,
    isPlaying: true,
  };
  const handlers = {
    onTogglePlay: vi.fn(),
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onSeek: vi.fn(),
    onSwitchToPopup: vi.fn(),
  };

  render(
    createElement(
      JotaiProvider,
      { store: createStore() },
      createElement(BarContent, { state, ...handlers }),
    ),
  );

  return handlers;
}

describe("BarContent", () => {
  it("先頭トラックでは前を無効化し、次のトラックへ移動できる", () => {
    const { onNext, onPrev, onSwitchToPopup } = renderBar(0);
    const previousButton = screen.getByRole("button", { name: "前のトラック" });
    const nextButton = screen.getByRole("button", { name: "次のトラック" });

    expect(previousButton).toBeDisabled();
    expect(nextButton).toBeEnabled();

    fireEvent.click(previousButton);
    fireEvent.click(nextButton);

    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onSwitchToPopup).not.toHaveBeenCalled();
  });

  it("末尾トラックでは次を無効化し、前のトラックへ移動できる", () => {
    const { onNext, onPrev, onSwitchToPopup } = renderBar(1);
    const previousButton = screen.getByRole("button", { name: "前のトラック" });
    const nextButton = screen.getByRole("button", { name: "次のトラック" });

    expect(previousButton).toBeEnabled();
    expect(nextButton).toBeDisabled();

    fireEvent.click(previousButton);
    fireEvent.click(nextButton);

    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
    expect(onSwitchToPopup).not.toHaveBeenCalled();
  });
});
