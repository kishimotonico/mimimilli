import type { AudioEngine } from "./audioEngine";
import type { PlayerCoreState } from "../../../entities/player/model/atoms";
import type { PlaybackSource } from "./playerController";
import type { PlaybackTrack } from "./trackTime";

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
  source: PlaybackSource["kind"];
  workId: string | null;
  fsPath: string | null;
  playlistId: string | null;
  trackIndex: number;
  track: PlaybackTrack;
  assetUrl: string;
}

export interface PlaybackContext {
  engine: AudioEngine;
  track: PlaybackTrack;
  trackDuration: number | null;
  currentTime: number;
}

export interface PlayerRuntimeRefs {
  coreState: MutableRef<PlayerCoreState>;
  engine: MutableRef<AudioEngine | null>;
  loadedTrack: MutableRef<LoadedTrack | null>;
  trackEnded: MutableRef<boolean>;
  updateMediaSessionPosition: MutableRef<(position?: number) => void>;
  /** Files モード即席トラックの durationchange 由来ファイル全体長。登録トラックでは未使用。 */
  filesModeFileDurationSec: MutableRef<number | null>;
  /** 直近の engine.load() が返したクリーンアップ関数。次のロード前・engine破棄時に呼ぶ。 */
  loadCleanup: MutableRef<(() => void) | null>;
}
