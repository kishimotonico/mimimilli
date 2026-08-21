import type { Work, WorkListItem } from "../../work/model";
import type { AudioEngineError } from "../../../shared/model/audioEngineError";
import type { PlaybackTrack } from "./playbackTrack";

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export interface AbRepeatRange {
  a: number | null;
  b: number | null;
}

/** AB区間が実際に成立している（ループ発動条件）かを判定する。 */
export function isAbRepeatEstablished(
  abRepeat: AbRepeatRange,
): abRepeat is { a: number; b: number } {
  return abRepeat.a !== null && abRepeat.b !== null && abRepeat.a < abRepeat.b;
}

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
  playbackRate: number;
  channelSwap: boolean;
  abRepeat: AbRepeatRange;
  playbackError: AudioEngineError | null;
}

interface PlaybackSourceFields {
  currentWork: WorkListItem | Work | null;
  isFilePlayback: boolean;
}

type ResolvedPlaybackSource =
  | { isFilePlayback: true; currentWork: WorkListItem | Work | null }
  | { isFilePlayback: false; currentWork: WorkListItem | Work };

/** ファイル再生か、作品再生で currentWork が確定しているか（= 再生対象が成立しているか）。 */
export function hasResolvedPlaybackSource<T extends PlaybackSourceFields>(
  state: T,
): state is T & ResolvedPlaybackSource {
  return state.currentWork !== null || state.isFilePlayback;
}

/** currentTrackIndex >= 0 && (currentWork !== null || isFilePlayback) が成立しているか。 */
export function isPlayerActive<T extends PlaybackSourceFields & { currentTrackIndex: number }>(
  state: T,
): state is T & ResolvedPlaybackSource {
  return state.currentTrackIndex >= 0 && hasResolvedPlaybackSource(state);
}

export interface ActiveTrackView {
  workTitle: string;
  trackTitle: string;
}

/**
 * 表示用の作品名・トラック名を求める。isPlayerActive が成立していない呼び出しでは、
 * 呼び出し元（playerIsActiveAtom 等）の前提が崩れているとみなし空表示を返す。
 */
export function selectActiveTrackView(state: {
  currentWork: WorkListItem | Work | null;
  isFilePlayback: boolean;
  tracks: PlaybackTrack[];
  currentTrackIndex: number;
}): ActiveTrackView {
  if (!hasResolvedPlaybackSource(state)) {
    return { workTitle: "", trackTitle: "—" };
  }
  const track = state.tracks[state.currentTrackIndex];
  return {
    workTitle: state.isFilePlayback ? "ファイル" : state.currentWork.title,
    trackTitle: track?.title ?? "—",
  };
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
  playbackRate: 1,
  channelSwap: false,
  abRepeat: { a: null, b: null },
  playbackError: null,
};
