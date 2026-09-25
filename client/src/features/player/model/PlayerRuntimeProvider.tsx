import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { Work } from "../../../entities/work/model";
import type { PlaybackContext } from "./playerRuntime";
import { PLAYER_CONTROLLER_INITIAL, PlayerController } from "./playerController";
import type { MutableRef, PendingResume, PlayerRuntimeRefs } from "./playerRuntime";
import type { PlaybackTrack } from "./trackTime";
import {
  loadPlayerPlaybackPrefs,
  persistPlaybackPrefsOnChange,
  withPlaybackPrefs,
} from "./playerPlaybackPrefs";

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
  /** 現在位置のresumeを即時保存し、書き込みが終わるまで待てる */
  flushCurrentResume: () => Promise<void>;
}

export const NOT_REGISTERED_ERROR =
  "PlayerRuntime capabilities are not registered. Mount <PlayerRuntime />.";

export interface PlayerRuntimeContextValue {
  controller: PlayerController;
  pendingResumeRef: MutableRef<PendingResume | null>;
  runtimeRefs: PlayerRuntimeRefs;
  registerCapabilities: (capabilities: PlayerRuntimeCapabilities) => () => void;
  requireCapabilities: () => PlayerRuntimeCapabilities;
  /** <PlayerRuntime>が未マウントならnull。再生中とは限らない場面（root再設定開始等）向け */
  getCapabilities: () => PlayerRuntimeCapabilities | null;
}

const PlayerRuntimeContext = createContext<PlayerRuntimeContextValue | null>(null);

export function PlayerRuntimeProvider({ children }: { children: ReactNode }) {
  const controllerRef = useRef<PlayerController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = new PlayerController(
      withPlaybackPrefs(PLAYER_CONTROLLER_INITIAL, loadPlayerPlaybackPrefs()),
    );
  }
  const controller = controllerRef.current;

  useEffect(() => persistPlaybackPrefsOnChange(controller), [controller]);

  const engineRef = useRef<PlayerRuntimeRefs["engine"]["current"]>(null);
  const loadedTrackRef = useRef<PlayerRuntimeRefs["loadedTrack"]["current"]>(null);
  const trackEndedRef = useRef(false);
  const updateMediaSessionPositionRef = useRef<(position?: number) => void>(() => {});
  const filesModeFileDurationSecRef = useRef<number | null>(null);
  const loadCleanupRef = useRef<(() => void) | null>(null);
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

  const getCapabilities = useCallback((): PlayerRuntimeCapabilities | null => {
    return capabilitiesRef.current;
  }, []);

  const value = useMemo<PlayerRuntimeContextValue>(
    () => ({
      controller,
      pendingResumeRef,
      runtimeRefs,
      registerCapabilities,
      requireCapabilities,
      getCapabilities,
    }),
    [controller, runtimeRefs, registerCapabilities, requireCapabilities, getCapabilities],
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
