import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  NOT_REGISTERED_ERROR,
  PlayerRuntimeProvider,
  usePlayerRuntimeContext,
} from "../../src/features/player/model/PlayerRuntimeProvider";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(PlayerRuntimeProvider, null, children);
}

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
