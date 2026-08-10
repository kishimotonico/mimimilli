import type { Work, WorkListItem } from "../../work/model";
import type { AudioEngineError } from "../../../shared/model/audioEngineError";
import type { PlaybackTrack } from "./playbackTrack";

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export interface PlayerCoreState {
  isPlaying: boolean;
  status: PlaybackStatus;
  currentTrackIndex: number;
  currentPlaylistId: string | null;
  currentWork: WorkListItem | Work | null;
  isFilePlayback: boolean;
  tracks: PlaybackTrack[];
  volume: number;
  loop: boolean;
  showFullPlayer: boolean;
  playbackRate: number;
  channelSwap: boolean;
  abRepeat: { a: number | null; b: number | null };
  playbackError: AudioEngineError | null;
}

export const PLAYER_CORE_INITIAL: PlayerCoreState = {
  isPlaying: false,
  status: "idle",
  currentTrackIndex: -1,
  currentPlaylistId: null,
  currentWork: null,
  isFilePlayback: false,
  tracks: [],
  volume: 75,
  loop: false,
  showFullPlayer: false,
  playbackRate: 1,
  channelSwap: false,
  abRepeat: { a: null, b: null },
  playbackError: null,
};
