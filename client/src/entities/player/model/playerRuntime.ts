import type { AudioEngine } from "./audioEngine";
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

export interface PlaybackContext {
  engine: AudioEngine;
  track: PlaybackTrack;
  trackDuration: number | null;
  currentTime: number;
}

export interface PlayerRuntimeRefs {
  engine: MutableRef<AudioEngine | null>;
  updateMediaSessionPosition: MutableRef<(position?: number) => void>;
  /** 直近の engine.load() が返したクリーンアップ関数。次のロード前・engine破棄時に呼ぶ。 */
  loadCleanup: MutableRef<(() => void) | null>;
}
