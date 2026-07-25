import type { Work, WorkListItem } from "../../../entities/work/model";
import type { AudioEngineError } from "./audioEngine";
import { isResolvedTrack, type PlaybackTrack } from "./trackTime";

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";
export type PlaybackCompletionScope = "queue" | "work";

export interface PlaybackItem {
  work: WorkListItem | Work;
  playlistId: string | null;
  tracks: PlaybackTrack[];
  trackIndex: number;
  completionScope: PlaybackCompletionScope;
}

export interface PlayerControllerState {
  status: PlaybackStatus;
  item: PlaybackItem | null;
  positionSec: number;
  durationSec: number | null;
  volume: number;
  loop: boolean;
  showFullPlayer: boolean;
  playbackRate: number;
  channelSwap: boolean;
  abRepeat: { a: number | null; b: number | null };
  playbackError: AudioEngineError | null;
}

export interface PlayerCoreState {
  isPlaying: boolean;
  currentTrackIndex: number;
  currentPlaylistId: string | null;
  currentWork: WorkListItem | Work | null;
  tracks: PlaybackTrack[];
  volume: number;
  loop: boolean;
  showFullPlayer: boolean;
  playbackRate: number;
  channelSwap: boolean;
  abRepeat: { a: number | null; b: number | null };
  playbackError: AudioEngineError | null;
}

export const PLAYER_CONTROLLER_INITIAL: PlayerControllerState = {
  status: "idle",
  item: null,
  positionSec: 0,
  durationSec: 0,
  volume: 75,
  loop: false,
  showFullPlayer: false,
  playbackRate: 1,
  channelSwap: false,
  abRepeat: { a: null, b: null },
  playbackError: null,
};

export const PLAYER_CORE_INITIAL: PlayerCoreState = toPlayerCoreState(PLAYER_CONTROLLER_INITIAL);

export type PlayerControllerInput =
  | { type: "startRequested"; item: PlaybackItem; positionSec?: number }
  | { type: "playRequested" }
  | { type: "pauseRequested" }
  | { type: "toggleRequested" }
  | { type: "stopRequested" }
  | { type: "seekRequested"; positionSec: number }
  | { type: "seekRelativeRequested"; deltaSec: number }
  | { type: "nextRequested" }
  | { type: "previousRequested" }
  | { type: "trackSelected"; trackIndex: number }
  | { type: "volumeChanged"; volume: number }
  | { type: "loopChanged"; loop: boolean }
  | { type: "fullPlayerVisibilityChanged"; visible: boolean }
  | { type: "playbackRateChanged"; playbackRate: number }
  | { type: "channelSwapChanged"; enabled: boolean }
  | { type: "abPointSet"; point: "a" | "b"; positionSec: number }
  | { type: "abCleared" }
  | { type: "audioPlaying" }
  | { type: "audioPaused" }
  | { type: "audioTimeUpdated"; positionSec: number }
  | { type: "audioDurationChanged"; durationSec: number | null }
  | { type: "audioEnded" }
  | { type: "audioFailed"; error: AudioEngineError }
  | { type: "persistTick" };

export type PlayerControllerCommand =
  | { type: "playAudio" }
  | { type: "pauseAudio" }
  | { type: "seekAudio"; positionSec: number }
  | { type: "loadTrack"; item: PlaybackItem; positionSec?: number }
  | { type: "setAudioVolume"; volume: number }
  | { type: "setAudioPlaybackRate"; playbackRate: number }
  | { type: "setAudioChannelSwap"; enabled: boolean }
  | { type: "persistResume"; reason: "track-change" | "pause" | "stop" | "interval" | "error" }
  | { type: "playbackQueueEnded"; item: PlaybackItem }
  | { type: "workCompleted"; item: PlaybackItem };

export interface PlayerTransition {
  state: PlayerControllerState;
  commands: PlayerControllerCommand[];
}

/** 選択トラックの再生時間を求める。登録トラックは DTO の durationSec、Files モードは未知（null）。 */
function selectedTrackDurationSec(item: PlaybackItem, trackIndex: number): number | null {
  const track = item.tracks[trackIndex];
  return track && isResolvedTrack(track) ? track.durationSec : null;
}

function withTrackIndex(state: PlayerControllerState, trackIndex: number): PlayerTransition {
  const item = state.item;
  if (
    !item ||
    trackIndex < 0 ||
    trackIndex >= item.tracks.length ||
    trackIndex === item.trackIndex
  ) {
    return { state, commands: [] };
  }
  const nextItem = { ...item, trackIndex };
  return {
    state: {
      ...state,
      item: nextItem,
      positionSec: 0,
      durationSec: selectedTrackDurationSec(item, trackIndex),
      abRepeat: { a: null, b: null },
      playbackError: null,
    },
    commands: [
      { type: "persistResume", reason: "track-change" },
      { type: "loadTrack", item: nextItem },
    ],
  };
}

export function reducePlayer(
  state: PlayerControllerState,
  input: PlayerControllerInput,
): PlayerTransition {
  switch (input.type) {
    case "startRequested":
      return {
        state: {
          ...state,
          status: "loading",
          item: input.item,
          positionSec: input.positionSec ?? 0,
          durationSec: selectedTrackDurationSec(input.item, input.item.trackIndex),
          abRepeat: { a: null, b: null },
          playbackError: null,
        },
        commands: [
          ...(state.item ? ([{ type: "persistResume", reason: "track-change" }] as const) : []),
          { type: "loadTrack", item: input.item, positionSec: input.positionSec },
        ],
      };
    case "playRequested":
      return state.item ? { state, commands: [{ type: "playAudio" }] } : { state, commands: [] };
    case "pauseRequested":
      return state.item ? { state, commands: [{ type: "pauseAudio" }] } : { state, commands: [] };
    case "toggleRequested":
      return reducePlayer(state, {
        type:
          state.status === "playing" || state.status === "loading"
            ? "pauseRequested"
            : "playRequested",
      });
    case "stopRequested":
      return {
        state: {
          ...state,
          status: "idle",
          item: null,
          positionSec: 0,
          durationSec: 0,
          playbackError: null,
          abRepeat: { a: null, b: null },
        },
        commands: state.item
          ? [
              { type: "persistResume", reason: "stop" },
              { type: "pauseAudio" },
              { type: "seekAudio", positionSec: 0 },
            ]
          : [],
      };
    case "seekRequested": {
      const maxSec = state.durationSec ?? Number.POSITIVE_INFINITY;
      const positionSec = Math.max(0, Math.min(input.positionSec, maxSec));
      return {
        state: { ...state, positionSec },
        commands: state.item ? [{ type: "seekAudio", positionSec }] : [],
      };
    }
    case "seekRelativeRequested":
      return reducePlayer(state, {
        type: "seekRequested",
        positionSec: state.positionSec + input.deltaSec,
      });
    case "nextRequested":
      return withTrackIndex(state, (state.item?.trackIndex ?? -1) + 1);
    case "previousRequested":
      return withTrackIndex(state, (state.item?.trackIndex ?? 0) - 1);
    case "trackSelected":
      return withTrackIndex(state, input.trackIndex);
    case "volumeChanged": {
      const volume = Math.max(0, Math.min(100, input.volume));
      return {
        state: { ...state, volume },
        commands: [{ type: "setAudioVolume", volume }],
      };
    }
    case "loopChanged":
      return { state: { ...state, loop: input.loop }, commands: [] };
    case "fullPlayerVisibilityChanged":
      return { state: { ...state, showFullPlayer: input.visible }, commands: [] };
    case "playbackRateChanged":
      return {
        state: { ...state, playbackRate: input.playbackRate },
        commands: [{ type: "setAudioPlaybackRate", playbackRate: input.playbackRate }],
      };
    case "channelSwapChanged":
      return {
        state: { ...state, channelSwap: input.enabled },
        commands: [{ type: "setAudioChannelSwap", enabled: input.enabled }],
      };
    case "abPointSet": {
      const points = { ...state.abRepeat, [input.point]: input.positionSec };
      const abRepeat =
        points.a !== null && points.b !== null && points.a > points.b
          ? { a: points.b, b: points.a }
          : points;
      return { state: { ...state, abRepeat }, commands: [] };
    }
    case "abCleared":
      return { state: { ...state, abRepeat: { a: null, b: null } }, commands: [] };
    case "audioPlaying":
      return {
        state: { ...state, status: "playing", playbackError: null },
        commands: [],
      };
    case "audioPaused":
      if (!state.item || state.status === "ended" || state.status === "error") {
        return { state, commands: [] };
      }
      return {
        state: { ...state, status: "paused" },
        commands: [{ type: "persistResume", reason: "pause" }],
      };
    case "audioTimeUpdated": {
      const commands: PlayerControllerCommand[] = [];
      const { a, b } = state.abRepeat;
      if (a !== null && b !== null && a < b && input.positionSec >= b) {
        commands.push({ type: "seekAudio", positionSec: a });
        return { state: { ...state, positionSec: a }, commands };
      }
      return { state: { ...state, positionSec: input.positionSec }, commands };
    }
    case "audioDurationChanged":
      return { state: { ...state, durationSec: input.durationSec }, commands: [] };
    case "audioEnded": {
      const item = state.item;
      if (!item) return { state, commands: [] };
      if (state.loop) {
        return {
          state: { ...state, status: "playing", positionSec: 0 },
          commands: [{ type: "seekAudio", positionSec: 0 }, { type: "playAudio" }],
        };
      }
      if (item.trackIndex < item.tracks.length - 1) {
        return withTrackIndex(state, item.trackIndex + 1);
      }
      const commands: PlayerControllerCommand[] = [{ type: "playbackQueueEnded", item }];
      if (item.completionScope === "work") commands.push({ type: "workCompleted", item });
      return { state: { ...state, status: "ended" }, commands };
    }
    case "audioFailed":
      return {
        state: { ...state, status: "error", playbackError: input.error },
        commands: state.item ? [{ type: "persistResume", reason: "error" }] : [],
      };
    case "persistTick":
      return state.status === "playing" && state.item
        ? { state, commands: [{ type: "persistResume", reason: "interval" }] }
        : { state, commands: [] };
  }
}

export function toPlayerCoreState(state: PlayerControllerState): PlayerCoreState {
  return {
    isPlaying: state.status === "playing" || state.status === "loading",
    currentTrackIndex: state.item?.trackIndex ?? -1,
    currentPlaylistId: state.item?.playlistId ?? null,
    currentWork: state.item?.work ?? null,
    tracks: state.item?.tracks ?? [],
    volume: state.volume,
    loop: state.loop,
    showFullPlayer: state.showFullPlayer,
    playbackRate: state.playbackRate,
    channelSwap: state.channelSwap,
    abRepeat: state.abRepeat,
    playbackError: state.playbackError,
  };
}

type StateListener = (state: PlayerControllerState) => void;
type CommandListener = (command: PlayerControllerCommand, state: PlayerControllerState) => void;

export class PlayerController {
  private state: PlayerControllerState;
  private readonly stateListeners = new Set<StateListener>();
  private readonly commandListeners = new Set<CommandListener>();

  constructor(initialState: PlayerControllerState = PLAYER_CONTROLLER_INITIAL) {
    this.state = initialState;
  }

  getState() {
    return this.state;
  }

  dispatch(input: PlayerControllerInput) {
    const transition = reducePlayer(this.state, input);
    if (transition.state !== this.state) {
      this.state = transition.state;
      for (const listener of this.stateListeners) listener(this.state);
    }
    for (const command of transition.commands) {
      for (const listener of this.commandListeners) listener(command, this.state);
    }
    return transition.commands;
  }

  subscribeState(listener: StateListener) {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  subscribeCommands(listener: CommandListener) {
    this.commandListeners.add(listener);
    return () => {
      this.commandListeners.delete(listener);
    };
  }
}
