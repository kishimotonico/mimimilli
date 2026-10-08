import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  NOT_REGISTERED_ERROR,
  PlayerRuntimeProvider,
  usePlayerRuntimeContext,
} from "../../src/entities/player/model/PlayerRuntimeProvider";
import {
  PLAYER_PLAYBACK_PREFS_KEY,
  loadPlayerPlaybackPrefs,
} from "../../src/entities/player/model/playerPlaybackPrefs";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(PlayerRuntimeProvider, null, children);
}

afterEach(() => {
  localStorage.removeItem(PLAYER_PLAYBACK_PREFS_KEY);
});

const capabilities = {
  loadResume: () => null,
  getCurrentPlaybackContext: () => null,
};

describe("PlayerRuntimeProvider capabilities", () => {
  it("未登録時は requireCapabilities が throw する", () => {
    const { result } = renderHook(() => usePlayerRuntimeContext(), { wrapper });
    expect(() => result.current.requireCapabilities()).toThrow(NOT_REGISTERED_ERROR);
  });

  it("登録後は requireCapabilities で capabilities を返し、解除後は throw する", () => {
    const { result } = renderHook(() => usePlayerRuntimeContext(), { wrapper });

    const unregister = result.current.registerCapabilities(capabilities);
    expect(result.current.requireCapabilities()).toBe(capabilities);

    unregister();
    expect(() => result.current.requireCapabilities()).toThrow(NOT_REGISTERED_ERROR);
  });

  it("StrictMode 相当の stale cleanup では新しい登録を解除しない", () => {
    const { result } = renderHook(() => usePlayerRuntimeContext(), { wrapper });
    const first = { ...capabilities };
    const second = { ...capabilities };

    const unregisterFirst = result.current.registerCapabilities(first);
    const unregisterSecond = result.current.registerCapabilities(second);
    unregisterFirst();

    expect(result.current.requireCapabilities()).toBe(second);
    unregisterSecond();
    expect(() => result.current.requireCapabilities()).toThrow(NOT_REGISTERED_ERROR);
  });
});

describe("PlayerRuntimeProvider playback prefs", () => {
  beforeEach(() => {
    localStorage.removeItem(PLAYER_PLAYBACK_PREFS_KEY);
  });

  it("保存済みの再生パラメータでコントローラを初期化する", () => {
    localStorage.setItem(
      PLAYER_PLAYBACK_PREFS_KEY,
      JSON.stringify({ volume: 30, loop: true, playbackRate: 1.5, channelSwap: true }),
    );
    const { result } = renderHook(() => usePlayerRuntimeContext(), { wrapper });
    expect(result.current.controller.getState()).toMatchObject({
      volume: 30,
      loop: true,
      playbackRate: 1.5,
      channelSwap: true,
    });
  });

  it("保存値が不正でも既定値で起動する", () => {
    localStorage.setItem(PLAYER_PLAYBACK_PREFS_KEY, "{broken");
    const { result } = renderHook(() => usePlayerRuntimeContext(), { wrapper });
    expect(result.current.controller.getState()).toMatchObject({
      volume: 75,
      loop: false,
      playbackRate: 1,
      channelSwap: false,
    });
  });

  it("音量変更を localStorage に保存する", () => {
    const { result } = renderHook(() => usePlayerRuntimeContext(), { wrapper });
    result.current.controller.dispatch({ type: "volumeChanged", volume: 10 });
    expect(loadPlayerPlaybackPrefs()).toEqual({
      volume: 10,
      loop: false,
      playbackRate: 1,
      channelSwap: false,
    });
  });
});
