import type { PlaybackContext } from "./playerRuntime";
import type { LoadResume } from "./PlayerRuntimeProvider";

export interface PlayerRuntimeCapabilities {
  loadResume: LoadResume;
  getCurrentPlaybackContext: () => PlaybackContext | null;
}

export interface PlayerRuntimeCapabilitiesRegistry {
  register: (capabilities: PlayerRuntimeCapabilities) => () => void;
  require: () => PlayerRuntimeCapabilities;
}

const NOT_REGISTERED_ERROR =
  "PlayerRuntime capabilities are not registered. Mount <PlayerRuntime />.";

export function createPlayerRuntimeCapabilitiesRegistry(): PlayerRuntimeCapabilitiesRegistry {
  let registrationToken = 0;
  let capabilities: PlayerRuntimeCapabilities | null = null;

  return {
    register(next) {
      const token = ++registrationToken;
      capabilities = next;
      return () => {
        if (registrationToken === token) {
          capabilities = null;
        }
      };
    },
    require() {
      if (!capabilities) {
        throw new Error(NOT_REGISTERED_ERROR);
      }
      return capabilities;
    },
  };
}

export { NOT_REGISTERED_ERROR };
