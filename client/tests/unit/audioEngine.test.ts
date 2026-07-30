import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAudioEngine,
  type AudioEngineCallbacks,
} from "../../src/features/player/model/audioEngine";

class FakeAudio extends EventTarget {
  currentTime = 0;
  duration = 0;
  error: MediaError | null = null;
  playbackRate = 1;
  readyState = 0;
  src = "";
  volume = 1;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
}

let audio: FakeAudio;

function callbacks(): AudioEngineCallbacks {
  return {
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onTimeUpdate: vi.fn(),
    onDurationChange: vi.fn(),
    onEnded: vi.fn(),
    onError: vi.fn(),
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "Audio",
    vi.fn(function FakeAudioConstructor() {
      audio = new FakeAudio();
      return audio;
    }) as unknown as typeof Audio,
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("HTMLAudio adapter contract", () => {
  it("loadでURL・音量・速度・開始絶対秒をHTMLAudioへ反映する", () => {
    const events = callbacks();
    const engine = createAudioEngine(75, events);

    engine.load("/audio/work-1/voice.wav", { playbackRate: 1.25, startSec: 30, autoplay: true });

    expect(audio.src).toBe("/audio/work-1/voice.wav");
    expect(audio.volume).toBe(0.75);
    expect(audio.playbackRate).toBe(1.25);
    expect(audio.currentTime).toBe(30);
    expect(audio.play).toHaveBeenCalledOnce();
  });

  it("autoplay:falseならloadしても再生しない", () => {
    const events = callbacks();
    const engine = createAudioEngine(75, events);

    engine.load("/audio/work-1/voice.wav", { playbackRate: 1, startSec: 30, autoplay: false });

    expect(audio.currentTime).toBe(30);
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("HTMLAudioの時刻・長さ・終了イベントをcallbackへ渡す", () => {
    const events = callbacks();
    createAudioEngine(75, events);
    audio.currentTime = 42;
    audio.duration = 120;

    audio.dispatchEvent(new Event("timeupdate"));
    audio.dispatchEvent(new Event("durationchange"));
    audio.dispatchEvent(new Event("ended"));

    expect(events.onTimeUpdate).toHaveBeenCalledWith(42);
    expect(events.onDurationChange).toHaveBeenCalledWith(120);
    expect(events.onEnded).toHaveBeenCalledWith(false);
  });

  it("play拒否を分類したAudioEngineErrorへ変換する", async () => {
    const events = callbacks();
    const error = new DOMException("User activation required", "NotAllowedError");
    const engine = createAudioEngine(75, events);
    audio.play.mockRejectedValueOnce(error);

    engine.play();
    await vi.waitFor(() =>
      expect(events.onError).toHaveBeenCalledWith({
        source: "play",
        name: "NotAllowedError",
        message: "User activation required",
      }),
    );
  });
});
