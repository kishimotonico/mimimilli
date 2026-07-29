import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import type { Work } from "../../../entities/work/model";
import { PLAYER_CORE_INITIAL } from "./atoms";
import { PlayerController } from "./playerController";
import { createPlayerRuntimeCapabilitiesRegistry } from "./playerRuntimeCapabilities";
import type { PlayerRuntimeCapabilitiesRegistry } from "./playerRuntimeCapabilities";
import type { MutableRef, PendingResume, PlayerRuntimeRefs } from "./playerRuntime";
import type { PlaybackTrack } from "./trackTime";

export interface LoadedResumePlayback {
  playlistId: string;
  tracks: PlaybackTrack[];
  trackIndex: number;
  positionSec: number;
}

export type LoadResume = (work: Work) => LoadedResumePlayback | null;

export interface PlayerRuntimeContextValue {
  controller: PlayerController;
  lastVolumeRef: MutableRef<number>;
  pendingResumeRef: MutableRef<PendingResume | null>;
  runtimeRefs: PlayerRuntimeRefs;
  capabilitiesRegistry: PlayerRuntimeCapabilitiesRegistry;
}

const PlayerRuntimeContext = createContext<PlayerRuntimeContextValue | null>(null);

export function PlayerRuntimeProvider({ children }: { children: ReactNode }) {
  const controllerRef = useRef<PlayerController | null>(null);
  if (controllerRef.current === null) controllerRef.current = new PlayerController();
  const controller = controllerRef.current;

  const coreStateRef = useRef(PLAYER_CORE_INITIAL);
  const engineRef = useRef<PlayerRuntimeRefs["engine"]["current"]>(null);
  const loadedTrackRef = useRef<PlayerRuntimeRefs["loadedTrack"]["current"]>(null);
  const trackEndedRef = useRef(false);
  const updateMediaSessionPositionRef = useRef<(position?: number) => void>(() => {});
  const filesModeFileDurationSecRef = useRef<number | null>(null);
  const lastVolumeRef = useRef(75);
  const pendingResumeRef = useRef<PendingResume | null>(null);
  const capabilitiesRegistryRef = useRef<PlayerRuntimeCapabilitiesRegistry | null>(null);
  if (capabilitiesRegistryRef.current === null) {
    capabilitiesRegistryRef.current = createPlayerRuntimeCapabilitiesRegistry();
  }
  const capabilitiesRegistry = capabilitiesRegistryRef.current;

  const runtimeRefs = useMemo<PlayerRuntimeRefs>(
    () => ({
      coreState: coreStateRef,
      engine: engineRef,
      loadedTrack: loadedTrackRef,
      trackEnded: trackEndedRef,
      updateMediaSessionPosition: updateMediaSessionPositionRef,
      filesModeFileDurationSec: filesModeFileDurationSecRef,
    }),
    [],
  );

  const value = useMemo<PlayerRuntimeContextValue>(
    () => ({
      controller,
      lastVolumeRef,
      pendingResumeRef,
      runtimeRefs,
      capabilitiesRegistry,
    }),
    [controller, runtimeRefs, capabilitiesRegistry],
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
