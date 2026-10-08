import type { Work, WorkListItem } from "../../work/model";
import type { AudioEngineError } from "./audioEngine";
import { createPlayRequestGuard } from "./playRequestGuard";
import {
  getTrackDurationSec,
  hasReachedTrackEnd,
  isResolvedTrack,
  toTrackRelativeTime,
  type PlaybackTrack,
} from "./trackTime";
import { reusesLoadedAsset, sharesAsset, toLoadedTrack, type LoadedTrack } from "./loadedTrack";
import {
  isAbRepeatEstablished,
  type AbRepeatRange,
  type PlaybackStatus,
  type PlayerCoreState,
} from "./playerCoreState";

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
  consecutiveTrackFailures: number;
  /** engine にロード済みのトラック。item の選択に追従し、engine 破棄で null に戻る。 */
  loaded: LoadedTrack | null;
  /** トラック終端に達して次の再生開始待ちか。 */
  trackEnded: boolean;
  /** Files モード即席トラックの durationchange 由来ファイル全体長。登録トラックでは未使用。 */
  fileDurationSec: number | null;
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
  consecutiveTrackFailures: 0,
  loaded: null,
  trackEnded: false,
  fileDurationSec: null,
};

/** 連続デコード失敗で停止する件数。全滅時の無限スキップを防ぐ。 */
export const MAX_CONSECUTIVE_TRACK_FAILURES = 2;

export function formatSkippedTrackToast(trackTitle: string): string {
  return `「${trackTitle}」を読み込めなかったためスキップしました`;
}

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
  | { type: "audioTimeChanged"; audioSec: number }
  /** durationSec はトラックではなく音源ファイル全体の長さ。 */
  | { type: "audioDurationChanged"; durationSec: number }
  | { type: "engineReleased" }
  | { type: "audioEnded" }
  | { type: "audioFailed"; error: AudioEngineError }
  | { type: "persistTick" }
  | { type: "retryRequested" }
  | { type: "errorDismissed" };

export type PlayerControllerCommand =
  | { type: "playAudio" }
  | { type: "pauseAudio" }
  | { type: "seekAudio"; positionSec: number }
  | {
      type: "loadTrack";
      item: PlaybackItem;
      positionSec?: number;
      autoplay: boolean;
      /** ロード済みの音源をそのまま使い、シークだけで移る。 */
      reusesAsset: boolean;
    }
  | { type: "setAudioVolume"; volume: number }
  | { type: "setAudioPlaybackRate"; playbackRate: number }
  | { type: "setAudioChannelSwap"; enabled: boolean }
  | { type: "persistResume"; reason: "track-change" | "pause" | "stop" | "interval" | "error" }
  | { type: "workCompleted"; item: PlaybackItem }
  | { type: "notifyTrackSkipped"; trackTitle: string; trackIndex: number };

export interface PlayerTransition {
  state: PlayerControllerState;
  commands: PlayerControllerCommand[];
}

/** 選択トラックの再生時間を求める。登録トラックは DTO の durationSec、Files モードは未知（null）。 */
function selectedTrackDurationSec(item: PlaybackItem, trackIndex: number): number | null {
  const track = item.tracks[trackIndex];
  return track && isResolvedTrack(track) ? track.durationSec : null;
}

/** 新しい項目をロードする遷移で更新する、engine ロード済みトラック周りの状態。 */
function enterLoad(state: PlayerControllerState, item: PlaybackItem) {
  const loaded = toLoadedTrack(item);
  const reusesAsset = reusesLoadedAsset(state.loaded, loaded);
  return {
    reusesAsset,
    fields: {
      loaded,
      trackEnded: false,
      fileDurationSec: reusesAsset ? state.fileDurationSec : null,
    },
  };
}

// 再生中のまま同一音源のトラックへ移るとき、engine は play イベントを再発火しないため status を loading に戻さない。
function loadingStatus(state: PlayerControllerState, reusesAsset: boolean): PlaybackStatus {
  return reusesAsset && state.status === "playing" ? "playing" : "loading";
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
  const load = enterLoad(state, nextItem);
  const nextStatus = intent === "explicit" ? loadingStatus(state, load.reusesAsset) : state.status;
  return {
    state: {
      ...state,
      ...load.fields,
      status: nextStatus,
      item: nextItem,
      positionSec: 0,
      durationSec: selectedTrackDurationSec(item, trackIndex),
      abRepeat: { a: null, b: null },
      playbackError: null,
      consecutiveTrackFailures: 0,
    },
    commands: [
      { type: "persistResume", reason: "track-change" },
      { type: "loadTrack", item: nextItem, autoplay, reusesAsset: load.reusesAsset },
    ],
  };
}

function reduceTimeUpdate(state: PlayerControllerState, positionSec: number): PlayerTransition {
  const commands: PlayerControllerCommand[] = [];
  const { abRepeat } = state;
  if (isAbRepeatEstablished(abRepeat) && positionSec >= abRepeat.b) {
    commands.push({ type: "seekAudio", positionSec: abRepeat.a });
    return { state: { ...state, positionSec: abRepeat.a }, commands };
  }
  return { state: { ...state, positionSec }, commands };
}

function reduceTrackEnded(state: PlayerControllerState): PlayerTransition {
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
  return { state: { ...state, status: "ended", trackEnded: true }, commands };
}

/**
 * トラックの終端処理。区間トラックの仮想終端ではファイル自体の再生が続くため、
 * 同じ音源で継続できない境界では明示的に止める。
 */
function finishTrack(state: PlayerControllerState, virtualEnd: boolean): PlayerTransition {
  const item = state.item;
  if (!item || state.trackEnded) return { state, commands: [] };
  const nextLoaded = toLoadedTrack(item, item.trackIndex + 1);
  const continuesAsset =
    state.loaded !== null && nextLoaded !== null && sharesAsset(state.loaded, nextLoaded);
  const ended = reduceTrackEnded(state);
  const pause: PlayerControllerCommand[] =
    virtualEnd && !continuesAsset ? [{ type: "pauseAudio" }] : [];
  return { state: ended.state, commands: [...pause, ...ended.commands] };
}

function reduceAudioTimeChanged(state: PlayerControllerState, audioSec: number): PlayerTransition {
  const loaded = state.loaded;
  if (!loaded) return { state, commands: [] };
  const durationSec = getTrackDurationSec(loaded.track, state.fileDurationSec);
  const reachedEnd = hasReachedTrackEnd(audioSec, loaded.track);
  const base = reduceTimeUpdate(
    reachedEnd ? state : { ...state, trackEnded: false },
    toTrackRelativeTime(audioSec, loaded.track, durationSec),
  );
  // B点が区間終端と一致する場合も、Aへのシークをトラック終了より優先する。
  if (!reachedEnd || base.commands.length > 0) return base;
  const finished = finishTrack(base.state, true);
  return { state: finished.state, commands: [...base.commands, ...finished.commands] };
}

export function reducePlayer(
  state: PlayerControllerState,
  input: PlayerControllerInput,
): PlayerTransition {
  switch (input.type) {
    case "startRequested": {
      const load = enterLoad(state, input.item);
      return {
        state: {
          ...state,
          ...load.fields,
          status: loadingStatus(state, load.reusesAsset),
          item: input.item,
          positionSec: input.positionSec ?? 0,
          durationSec: selectedTrackDurationSec(input.item, input.item.trackIndex),
          abRepeat: { a: null, b: null },
          playbackError: null,
          consecutiveTrackFailures: 0,
        },
        commands: [
          ...(state.item ? ([{ type: "persistResume", reason: "track-change" }] as const) : []),
          {
            type: "loadTrack",
            item: input.item,
            positionSec: input.positionSec,
            autoplay: true,
            reusesAsset: load.reusesAsset,
          },
        ],
      };
    }
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
          consecutiveTrackFailures: 0,
          abRepeat: { a: null, b: null },
          loaded: null,
          trackEnded: false,
          fileDurationSec: null,
        },
        commands: state.item
          ? [{ type: "persistResume", reason: "stop" }, { type: "pauseAudio" }]
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
    case "audioPlaying": {
      const playing = {
        ...state,
        status: "playing" as const,
        playbackError: null,
        consecutiveTrackFailures: 0,
      };
      if (!state.trackEnded) return { state: playing, commands: [] };
      // 終端で止まったトラックを再生し直すときは先頭へ戻す。
      return {
        state: { ...playing, trackEnded: false, positionSec: 0 },
        commands: state.loaded ? [{ type: "seekAudio", positionSec: 0 }] : [],
      };
    }
    case "audioPaused":
      if (!state.item || state.trackEnded || state.status === "ended" || state.status === "error") {
        return { state, commands: [] };
      }
      return {
        state: { ...state, status: "paused" },
        commands: [{ type: "persistResume", reason: "pause" }],
      };
    case "audioTimeUpdated":
      return reduceTimeUpdate(state, input.positionSec);
    case "audioTimeChanged":
      return reduceAudioTimeChanged(state, input.audioSec);
    case "audioDurationChanged": {
      const loaded = state.loaded;
      if (!loaded || isResolvedTrack(loaded.track)) return { state, commands: [] };
      return {
        state: {
          ...state,
          fileDurationSec: input.durationSec,
          durationSec: getTrackDurationSec(loaded.track, input.durationSec),
        },
        commands: [],
      };
    }
    case "engineReleased":
      return {
        state: { ...state, loaded: null, trackEnded: false, fileDurationSec: null },
        commands: [],
      };
    case "audioEnded":
      return finishTrack(state, false);
    case "audioFailed": {
      // engine 世代防御のセーフティネット: 再生対象がない／既に終了した項目への遅延失敗は無視する。
      if (!state.item || state.status === "idle" || state.status === "ended") {
        return { state, commands: [] };
      }
      const failedItem = state.item;
      const consecutiveTrackFailures = state.consecutiveTrackFailures + 1;
      const isLastTrack = failedItem.trackIndex >= failedItem.tracks.length - 1;
      if (isLastTrack || consecutiveTrackFailures >= MAX_CONSECUTIVE_TRACK_FAILURES) {
        return {
          state: {
            ...state,
            status: "error",
            playbackError: input.error,
            consecutiveTrackFailures,
          },
          commands: [{ type: "persistResume", reason: "error" }],
        };
      }
      const skipped = withTrackIndex(state, failedItem.trackIndex + 1, "preserve");
      if (skipped.state === state) {
        return {
          state: {
            ...state,
            status: "error",
            playbackError: input.error,
            consecutiveTrackFailures,
          },
          commands: [{ type: "persistResume", reason: "error" }],
        };
      }
      const failedTrack = failedItem.tracks[failedItem.trackIndex];
      return {
        state: { ...skipped.state, consecutiveTrackFailures },
        commands: [
          ...skipped.commands,
          {
            type: "notifyTrackSkipped",
            trackTitle: failedTrack?.title ?? "",
            trackIndex: failedItem.trackIndex,
          },
        ],
      };
    }
    case "persistTick":
      return state.status === "playing" && state.item
        ? { state, commands: [{ type: "persistResume", reason: "interval" }] }
        : { state, commands: [] };
    case "retryRequested": {
      if (!state.item || state.status !== "error") return { state, commands: [] };
      const load = enterLoad(state, state.item);
      return {
        state: {
          ...state,
          ...load.fields,
          status: "loading",
          playbackError: null,
          consecutiveTrackFailures: 0,
        },
        commands: [
          {
            type: "loadTrack",
            item: state.item,
            positionSec: state.positionSec,
            autoplay: true,
            reusesAsset: load.reusesAsset,
          },
        ],
      };
    }
    case "errorDismissed":
      if (state.status !== "error") return { state, commands: [] };
      return {
        state: {
          ...state,
          status: "paused",
          playbackError: null,
          consecutiveTrackFailures: 0,
        },
        commands: [],
      };
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
/** previous は遷移前の状態。コマンドは遷移後の状態に対して発行されるが、保存系は遷移前のトラックを対象にする。 */
type CommandListener = (
  command: PlayerControllerCommand,
  state: PlayerControllerState,
  previous: PlayerControllerState,
) => void;

export class PlayerController {
  private state: PlayerControllerState;
  private readonly stateListeners = new Set<StateListener>();
  private readonly commandListeners = new Set<CommandListener>();
  /** 停止・再生開始のたびに無効化され、準備待ちの作品再生要求が後から再生を始めるのを防ぐ */
  readonly playRequests = createPlayRequestGuard();

  constructor(initialState: PlayerControllerState = PLAYER_CONTROLLER_INITIAL) {
    this.state = initialState;
  }

  getState() {
    return this.state;
  }

  dispatch(input: PlayerControllerInput) {
    if (input.type === "stopRequested" || input.type === "startRequested") {
      this.playRequests.invalidate();
    }
    const previous = this.state;
    const transition = reducePlayer(previous, input);
    if (transition.state !== this.state) {
      this.state = transition.state;
      for (const listener of this.stateListeners) listener(this.state);
    }
    for (const command of transition.commands) {
      for (const listener of this.commandListeners) listener(command, this.state, previous);
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
