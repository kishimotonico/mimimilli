// Audio engine: HTML Audio 要素と Web Audio API の低レベル操作。
// React に依存せず、usePlayer フックから useRef で保持して使う。
// 副作用（再生状態・時刻）は callback で通知し、フック側で state/atom に反映する。

export interface AudioEngineCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  /** トラック再生終了時。自動送りするか、ループするかはフック側が判断する。 */
  onEnded: (looping: boolean) => void;
  onError: (error: AudioEngineError) => void;
}

export interface AudioEngineError {
  source: "play" | "media";
  name?: string;
  code?: number;
  message: string;
}

export interface AudioEngine {
  /** トラックを読み込み再生開始する。pendingSeekSec > 0 のとき metadata 取得後にシークする。 */
  load: (
    url: string,
    opts: {
      playbackRate: number;
      startSec?: number;
      pendingSeekSec?: number;
    },
  ) => () => void; // クリーンアップ関数を返す
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  seekRelative: (delta: number) => void;
  setVolume: (vol: number) => void; // 0-100
  setPlaybackRate: (rate: number) => void;
  setChannelSwap: (enabled: boolean) => void;
  resumeAudioContext: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

export function createAudioEngine(
  initialVolume: number, // 0-100
  callbacks: AudioEngineCallbacks,
): AudioEngine {
  const audio = new Audio();
  audio.volume = initialVolume / 100;

  // Web Audio API ノード（チャンネルスワップ機能用。遅延初期化）
  let audioCtx: AudioContext | null = null;
  let sourceNode: MediaElementAudioSourceNode | null = null;
  let splitterNode: ChannelSplitterNode | null = null;
  let mergerNode: ChannelMergerNode | null = null;
  let channelSwapEnabled = false;

  // イベントリスナーを登録
  const onPlay = () => callbacks.onPlay();
  const onPause = () => callbacks.onPause();
  const onTimeUpdate = () => callbacks.onTimeUpdate(audio.currentTime);
  const onDurationChange = () => callbacks.onDurationChange(audio.duration || 0);
  const onEnded = () => callbacks.onEnded(false); // ループ判定はフック側
  const onError = () => callbacks.onError(toMediaError(audio.error));

  audio.addEventListener("play", onPlay);
  audio.addEventListener("pause", onPause);
  audio.addEventListener("timeupdate", onTimeUpdate);
  audio.addEventListener("durationchange", onDurationChange);
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("error", onError);

  function toPlayError(error: unknown): AudioEngineError {
    if (error instanceof Error) {
      return {
        source: "play",
        name: error.name,
        message: error.message || "音声の再生に失敗しました。",
      };
    }
    if (isErrorLike(error)) {
      return {
        source: "play",
        name: error.name,
        message: error.message || "音声の再生に失敗しました。",
      };
    }
    return {
      source: "play",
      message: typeof error === "string" && error ? error : "音声の再生に失敗しました。",
    };
  }

  function isErrorLike(error: unknown): error is { name?: string; message?: string } {
    return typeof error === "object" && error !== null && ("message" in error || "name" in error);
  }

  function toMediaError(error: MediaError | null): AudioEngineError {
    return {
      source: "media",
      code: error?.code,
      message: error?.message || mediaErrorMessage(error?.code),
    };
  }

  function mediaErrorMessage(code: number | undefined): string {
    switch (code) {
      case 1:
        return "音声の読み込みが中断されました。";
      case 2:
        return "ネットワークエラーにより音声を読み込めませんでした。";
      case 3:
        return "音声データのデコードに失敗しました。";
      case 4:
        return "この音声形式またはURLは再生できません。";
      default:
        return "音声の読み込みに失敗しました。";
    }
  }

  function playAudio() {
    audio.play().catch((error: unknown) => callbacks.onError(toPlayError(error)));
  }

  function resumeAudioContext() {
    if (audioCtx?.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  function setupChannelSwap() {
    if (audioCtx) return; // 済み
    audioCtx = new AudioContext();
    audioCtx.resume().catch(() => {});
    sourceNode = audioCtx.createMediaElementSource(audio);
    splitterNode = audioCtx.createChannelSplitter(2);
    mergerNode = audioCtx.createChannelMerger(2);
    sourceNode.connect(audioCtx.destination); // 初期接続（スワップなし）
  }

  function applyChannelSwapInternal(enabled: boolean) {
    if (!audioCtx || !sourceNode || !splitterNode || !mergerNode) return;
    resumeAudioContext();
    sourceNode.disconnect();
    if (enabled) {
      sourceNode.connect(splitterNode);
      splitterNode.connect(mergerNode, 0, 1); // L → R
      splitterNode.connect(mergerNode, 1, 0); // R → L
      mergerNode.connect(audioCtx.destination);
    } else {
      sourceNode.connect(audioCtx.destination);
    }
  }

  return {
    load(url, opts) {
      audio.src = url;
      audio.playbackRate = opts.playbackRate;

      // pending seek: loadedmetadata / canplay 後にシーク
      let cleaned = false;
      const seekAfterMetadata = () => {
        if (cleaned || !opts.pendingSeekSec) return;
        audio.currentTime = opts.pendingSeekSec;
        audio.removeEventListener("loadedmetadata", seekAfterMetadata);
        audio.removeEventListener("canplay", seekAfterMetadata);
      };

      if (opts.pendingSeekSec && opts.pendingSeekSec > 0) {
        audio.addEventListener("loadedmetadata", seekAfterMetadata, { once: true });
        audio.addEventListener("canplay", seekAfterMetadata, { once: true });
        // readyState が既に HAVE_METADATA 以上なら即時シーク
        if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
          seekAfterMetadata();
        }
      } else if (opts.startSec !== undefined) {
        audio.currentTime = opts.startSec;
      }

      resumeAudioContext();
      playAudio();

      return () => {
        cleaned = true;
        audio.removeEventListener("loadedmetadata", seekAfterMetadata);
        audio.removeEventListener("canplay", seekAfterMetadata);
      };
    },

    play() {
      resumeAudioContext();
      playAudio();
    },

    pause() {
      audio.pause();
    },

    seek(time) {
      audio.currentTime = time;
    },

    seekRelative(delta) {
      audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + delta));
    },

    setVolume(vol) {
      audio.volume = Math.max(0, Math.min(100, vol)) / 100;
    },

    setPlaybackRate(rate) {
      audio.playbackRate = rate;
    },

    setChannelSwap(enabled) {
      channelSwapEnabled = enabled;
      if (!audioCtx) {
        if (enabled) {
          setupChannelSwap();
          // setup は同期なので即時適用
          applyChannelSwapInternal(enabled);
        }
        return;
      }
      applyChannelSwapInternal(enabled);
    },

    resumeAudioContext,

    getCurrentTime: () => audio.currentTime,
    getDuration: () => audio.duration || 0,

    destroy() {
      audio.pause();
      audio.src = "";
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audioCtx?.close().catch(() => {});
      // channelSwapEnabled は GC に任せる
      void channelSwapEnabled;
    },
  };
}
