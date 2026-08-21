import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import NowPlayingScrub from "../../src/features/player/ui/NowPlayingScrub";
import { playerCurrentTimeAtom, playerDurationAtom } from "../../src/entities/player/model/atoms";
import type { PlayerState } from "../../src/features/player/model/usePlayerState";

function renderScrub(abRepeat: PlayerState["abRepeat"], onSetABPointAt = vi.fn()) {
  const store = createStore();
  store.set(playerCurrentTimeAtom, 30);
  store.set(playerDurationAtom, 120);

  render(
    createElement(
      JotaiProvider,
      { store },
      createElement(NowPlayingScrub, {
        mode: "normal",
        onSeek: vi.fn(),
        abRepeat,
        onSetABPointAt,
      }),
    ),
  );
  return { onSetABPointAt };
}

describe("NowPlayingScrub", () => {
  it("AB両方が未設定のときはハンドルを表示しない", () => {
    renderScrub({ a: null, b: null });
    expect(screen.queryByRole("slider", { name: "AB区間の開始位置" })).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "AB区間の終了位置" })).not.toBeInTheDocument();
  });

  it("A地点のみ設定時は開始ハンドルだけを表示する", () => {
    renderScrub({ a: 10, b: null });
    expect(screen.getByRole("slider", { name: "AB区間の開始位置" })).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "AB区間の終了位置" })).not.toBeInTheDocument();
  });

  it("A/B両方設定時は両ハンドルを表示し、矢印キーで1秒刻みに動かせる", () => {
    const { onSetABPointAt } = renderScrub({ a: 10, b: 60 });
    const startHandle = screen.getByRole("slider", { name: "AB区間の開始位置" });
    const endHandle = screen.getByRole("slider", { name: "AB区間の終了位置" });
    expect(startHandle).toBeInTheDocument();
    expect(endHandle).toBeInTheDocument();

    fireEvent.keyDown(startHandle, { key: "ArrowRight" });
    expect(onSetABPointAt).toHaveBeenCalledWith("a", 11);

    fireEvent.keyDown(endHandle, { key: "ArrowLeft" });
    expect(onSetABPointAt).toHaveBeenCalledWith("b", 59);
  });

  it("ドラッグ（pointerdown→pointermove）でハンドル位置をトラック比率から設定する", () => {
    const { onSetABPointAt } = renderScrub({ a: 10, b: 60 });
    const startHandle = screen.getByRole("slider", { name: "AB区間の開始位置" });
    const track = startHandle.parentElement as HTMLElement;
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
      left: 0,
      right: 200,
      top: 0,
      bottom: 0,
      width: 200,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent.pointerDown(startHandle, { pointerId: 1, clientX: 100 });
    expect(onSetABPointAt).toHaveBeenCalledWith("a", 60);

    fireEvent.pointerMove(startHandle, { pointerId: 1, clientX: 50 });
    expect(onSetABPointAt).toHaveBeenCalledWith("a", 30);

    fireEvent.pointerCancel(startHandle, { pointerId: 1 });
    fireEvent.pointerMove(startHandle, { pointerId: 1, clientX: 150 });
    expect(onSetABPointAt).not.toHaveBeenCalledWith("a", 90);
  });
});
