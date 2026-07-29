import { describe, expect, it } from "vitest";
import {
  NOT_REGISTERED_ERROR,
  createPlayerRuntimeCapabilitiesRegistry,
} from "../../src/features/player/model/playerRuntimeCapabilities";

describe("createPlayerRuntimeCapabilitiesRegistry", () => {
  it("未登録時は require が throw する", () => {
    const registry = createPlayerRuntimeCapabilitiesRegistry();
    expect(() => registry.require()).toThrow(NOT_REGISTERED_ERROR);
  });

  it("登録後は require で capabilities を返す", () => {
    const registry = createPlayerRuntimeCapabilitiesRegistry();
    const capabilities = {
      loadResume: () => null,
      getCurrentPlaybackContext: () => null,
    };
    const unregister = registry.register(capabilities);
    expect(registry.require()).toBe(capabilities);
    unregister();
    expect(() => registry.require()).toThrow(NOT_REGISTERED_ERROR);
  });

  it("StrictMode 相当の stale cleanup では新しい登録を解除しない", () => {
    const registry = createPlayerRuntimeCapabilitiesRegistry();
    const first = {
      loadResume: () => null,
      getCurrentPlaybackContext: () => null,
    };
    const second = {
      loadResume: () => null,
      getCurrentPlaybackContext: () => null,
    };

    const unregisterFirst = registry.register(first);
    const unregisterSecond = registry.register(second);
    unregisterFirst();

    expect(registry.require()).toBe(second);
    unregisterSecond();
    expect(() => registry.require()).toThrow(NOT_REGISTERED_ERROR);
  });
});
