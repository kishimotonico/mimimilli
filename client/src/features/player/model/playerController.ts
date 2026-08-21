import type { Work, WorkListItem } from "../../../entities/work/model";
import type { AudioEngineError } from "./audioEngine";
import { isResolvedTrack, type PlaybackTrack } from "./trackTime";
import {
  isAbRepeatEstablished,
  type AbRepeatRange,
  type PlaybackStatus,
  type PlayerCoreState,
} from "../../../entities/player/model/playerCoreState";

export type PlaybackCompletionScope = "queue" | "work";

export type PlaybackSource = { kind: "work"; work: WorkListItem | Work } | { kind: "file" };

export interface PlaybackItem {
  source: PlaybackSource;
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
  playbackRate: number;
  channelSwap: boolean;
  abRepeat: AbRepeatRange;
  playbackError: AudioEngineError | null;
}

export const PLAYER_CONTROLLER_INITIAL: PlayerControllerState = {
  status: "idle",
  item: null,
  positionSec: 0,
  durationSec: 0,
  volume: 75,
  loop: false,
  playbackRate: 1,
  channelSwap: false,
  abRepeat: { a: null, b: null },
  playbackError: null,
};

const EMPTY_TRACKS: PlaybackTrack[] = [];

type PlayerCoreComparators = {
  [K in keyof PlayerCoreState]: (a: PlayerCoreState[K], b: PlayerCoreState[K]) => boolean;
};

// 保守的な契約: 参照が異なる非空配列は要素を見ずに false 扱いにする（tracks を毎回組み立て直すコードが入ると常に不一致判定になる）。
function areTracksEqual(a: PlaybackTrack[], b: PlaybackTrack[]): boolean {
  if (a === b) return true;
  return a.length === 0 && b.length === 0;
}

function areAbRepeatEqual(a: PlayerCoreState["abRepeat"], b: PlayerCoreState["abRepeat"]): boolean {
  return a.a === b.a && a.b === b.b;
}

function arePlaybackErrorsEqual(a: AudioEngineError | null, b: AudioEngineError | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.source === b.source && a.name === b.name && a.code === b.code && a.message === b.message;
}

const playerCoreComparators = {
  isPlaying: Object.is,
  status: Object.is,
  currentTrackIndex: Object.is,
  currentPlaylistId: Object.is,
  currentWork: Object.is,
  isFilePlayback: Object.is,
  tracks: areTracksEqual,
  volume: Object.is,
  loop: Object.is,
  playbackRate: Object.is,
  channelSwap: Object.is,
  abRepeat: areAbRepeatEqual,
  playbackError: arePlaybackErrorsEqual,
} satisfies PlayerCoreComparators;

/** positionSec / durationSec を除く core 投影の意味的同一性。 */
export function isPlayerCoreStateEqual(prev: PlayerCoreState, next: PlayerCoreState): boolean {
  for (const key of Object.keys(playerCoreComparators) as (keyof PlayerCoreState)[]) {
    if (!playerCoreComparators[key](prev[key], next[key])) return false;
  }
  return true;
}

export type PlayerControllerInput =
  | { type: "startRequested"; item: PlaybackItem; positionSec?: number }
  | { type: "playRequested" }
  | { type: "pauseRequested" }
  | { type: "toggleRequested" }
  | { type: "stopRequested" }
  | { type: "seekRequested"; positionSec: number }
  | { type: "nextRequested" }
  | { type: "previousRequested" }
  | { type: "trackSelected"; trackIndex: number }
  | { type: "volumeChanged"; volume: number }
  | { type: "loopChanged"; loop: boolean }
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
  | { type: "loadTrack"; item: PlaybackItem; positionSec?: number; autoplay: boolean }
  | { type: "setAudioVolume"; volume: number }
  | { type: "setAudioPlaybackRate"; playbackRate: number }
  | { type: "setAudioChannelSwap"; enabled: boolean }
  | { type: "persistResume"; reason: "track-change" | "pause" | "stop" | "interval" | "error" }
  | { type: "workCompleted"; item: PlaybackItem }
  | { type: "releaseLoadedTrack" };

export interface PlayerTransition {
  state: PlayerControllerState;
  commands: PlayerControllerCommand[];
}

/** 選択トラックの再生時間を求める。登録トラックは DTO の durationSec、Files モードは未知（null）。 */
function selectedTrackDurationSec(item: PlaybackItem, trackIndex: number): number | null {
  const track = item.tracks[trackIndex];
  return track && isResolvedTrack(track) ? track.durationSec : null;
}

/**
 * トラック切替の再生意図（Spotify型）。
 * - "preserve": 次へ/前へ等の送り操作。遷移前の再生状態を維持する（一時停止中なら一時停止のまま）。
 * - "explicit": トラックリストからの明示選択。聴く意図の表明とみなし、一時停止中でも再生を開始する。
 */
type TrackChangeIntent = "preserve" | "explicit";

function withTrackIndex(
  state: PlayerControllerState,
  trackIndex: number,
  intent: TrackChangeIntent,
): PlayerTransition {
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
  const wasPlaying = state.status === "playing" || state.status === "loading";
  const autoplay = intent === "explicit" || wasPlaying;
  const nextStatus = intent === "explicit" ? "loading" : state.status;
  return {
    state: {
      ...state,
      status: nextStatus,
      item: nextItem,
      positionSec: 0,
      durationSec: selectedTrackDurationSec(item, trackIndex),
      abRepeat: { a: null, b: null },
      playbackError: null,
    },
    commands: [
      { type: "persistResume", reason: "track-change" },
      { type: "loadTrack", item: nextItem, autoplay },
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
          { type: "loadTrack", item: input.item, positionSec: input.positionSec, autoplay: true },
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
              { type: "releaseLoadedTrack" },
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
    case "nextRequested":
      return withTrackIndex(state, (state.item?.trackIndex ?? -1) + 1, "preserve");
    case "previousRequested":
      return withTrackIndex(state, (state.item?.trackIndex ?? 0) - 1, "preserve");
    case "trackSelected":
      return withTrackIndex(state, input.trackIndex, "explicit");
    case "volumeChanged": {
      const volume = Math.max(0, Math.min(100, input.volume));
      return {
        state: { ...state, volume },
        commands: [{ type: "setAudioVolume", volume }],
      };
    }
    case "loopChanged":
      return { state: { ...state, loop: input.loop }, commands: [] };
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
      const { abRepeat } = state;
      if (isAbRepeatEstablished(abRepeat) && input.positionSec >= abRepeat.b) {
        commands.push({ type: "seekAudio", positionSec: abRepeat.a });
        return { state: { ...state, positionSec: abRepeat.a }, commands };
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
        return withTrackIndex(state, item.trackIndex + 1, "preserve");
      }
      const commands: PlayerControllerCommand[] = [];
      if (item.completionScope === "work") commands.push({ type: "workCompleted", item });
      return { state: { ...state, status: "ended" }, commands };
    }
    case "audioFailed":
      // engine 世代防御のセーフティネット: 再生対象がない／既に終了した項目への遅延失敗は無視する。
      if (!state.item || state.status === "idle" || state.status === "ended") {
        return { state, commands: [] };
      }
      return {
        state: { ...state, status: "error", playbackError: input.error },
        commands: [{ type: "persistResume", reason: "error" }],
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
    status: state.status,
    currentTrackIndex: state.item?.trackIndex ?? -1,
    currentPlaylistId: state.item?.playlistId ?? null,
    currentWork: state.item?.source.kind === "work" ? state.item.source.work : null,
    isFilePlayback: state.item?.source.kind === "file",
    tracks: state.item?.tracks ?? EMPTY_TRACKS,
    volume: state.volume,
    loop: state.loop,
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
