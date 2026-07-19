import type { Track } from "../../../entities/work/model";
import type { AudioEngine } from "./audioEngine";
import type { PlayerCoreState } from "./atoms";

export interface MutableRef<T> {
  current: T;
}

export interface PendingResume {
  workId: string;
  playlistId: string;
  trackId: string;
  offsetSec: number;
}

export interface LoadedTrack {
  workId: string;
  playlistId: string | null;
  trackIndex: number;
  track: Track;
  assetUrl: string;
}

export interface PlaybackContext {
  engine: AudioEngine;
  track: Track;
  trackDuration: number;
  currentTime: number;
}

export interface PlayerRuntimeRefs {
  coreState: MutableRef<PlayerCoreState>;
  loop: MutableRef<boolean>;
  abRepeat: MutableRef<PlayerCoreState["abRepeat"]>;
  engine: MutableRef<AudioEngine | null>;
  loadedTrack: MutableRef<LoadedTrack | null>;
  trackEnded: MutableRef<boolean>;
  updateMediaSessionPosition: MutableRef<(position?: number) => void>;
}

export type SetCoreState = (
  update: PlayerCoreState | ((previous: PlayerCoreState) => PlayerCoreState),
) => void;
