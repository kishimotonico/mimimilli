import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import type { Work } from "../../../entities/work/model";
import type { PlaybackContext } from "./playerRuntime";
import { PlayerController } from "./playerController";
import type { MutableRef, PendingResume, PlayerRuntimeRefs } from "./playerRuntime";
import type { PlaybackTrack } from "./trackTime";

export interface LoadedResumePlayback {
  playlistId: string;
  tracks: PlaybackTrack[];
  trackIndex: number;
  positionSec: number;
}

export type LoadResume = (work: Work) => LoadedResumePlayback | null;

export interface PlayerRuntimeCapabilities {
  loadResume: LoadResume;
  getCurrentPlaybackContext: () => PlaybackContext | null;
}

export const NOT_REGISTERED_ERROR =
  "PlayerRuntime capabilities are not registered. Mount <PlayerRuntime />.";

export interface PlayerRuntimeContextValue {
  controller: PlayerController;
  lastVolumeRef: MutableRef<number>;
  pendingResumeRef: MutableRef<PendingResume | null>;
  runtimeRefs: PlayerRuntimeRefs;
  registerCapabilities: (capabilities: PlayerRuntimeCapabilities) => () => void;
  requireCapabilities: () => PlayerRuntimeCapabilities;
}

const PlayerRuntimeContext = createContext<PlayerRuntimeContextValue | null>(null);

export function PlayerRuntimeProvider({ children }: { children: ReactNode }) {
  const controllerRef = useRef<PlayerController | null>(null);
  if (controllerRef.current === null) controllerRef.current = new PlayerController();
  const controller = controllerRef.current;

  const engineRef = useRef<PlayerRuntimeRefs["engine"]["current"]>(null);
  const loadedTrackRef = useRef<PlayerRuntimeRefs["loadedTrack"]["current"]>(null);
  const trackEndedRef = useRef(false);
  const updateMediaSessionPositionRef = useRef<(position?: number) => void>(() => {});
  const filesModeFileDurationSecRef = useRef<number | null>(null);
  const loadCleanupRef = useRef<(() => void) | null>(null);
  const lastVolumeRef = useRef(75);
  const pendingResumeRef = useRef<PendingResume | null>(null);
  const capabilitiesRef = useRef<PlayerRuntimeCapabilities | null>(null);
  const capabilitiesTokenRef = useRef(0);

  const runtimeRefs = useMemo<PlayerRuntimeRefs>(
    () => ({
      engine: engineRef,
      loadedTrack: loadedTrackRef,
      trackEnded: trackEndedRef,
      updateMediaSessionPosition: updateMediaSessionPositionRef,
      filesModeFileDurationSec: filesModeFileDurationSecRef,
      loadCleanup: loadCleanupRef,
    }),
    [],
  );

  const registerCapabilities = useCallback((next: PlayerRuntimeCapabilities) => {
    const token = ++capabilitiesTokenRef.current;
    capabilitiesRef.current = next;
    return () => {
      if (capabilitiesTokenRef.current === token) {
        capabilitiesRef.current = null;
      }
    };
  }, []);

  const requireCapabilities = useCallback((): PlayerRuntimeCapabilities => {
    if (!capabilitiesRef.current) {
      throw new Error(NOT_REGISTERED_ERROR);
    }
    return capabilitiesRef.current;
  }, []);

  const value = useMemo<PlayerRuntimeContextValue>(
    () => ({
      controller,
      lastVolumeRef,
      pendingResumeRef,
      runtimeRefs,
      registerCapabilities,
      requireCapabilities,
    }),
    [controller, runtimeRefs, registerCapabilities, requireCapabilities],
  );

  return <PlayerRuntimeContext.Provider value={value}>{children}</PlayerRuntimeContext.Provider>;
}

export function usePlayerRuntimeContext(): PlayerRuntimeContextValue {
  const value = useContext(PlayerRuntimeContext);
  if (!value) {
    throw new Error("usePlayerRuntimeContext must be used within PlayerRuntimeProvider");
  }
  return value;
}
