import { StrictMode, createElement, useMemo, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore, useAtomValue } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatTime, formatDuration, formatFileSize } from "../../src/shared/lib/format";
import { usePlayer } from "../../src/features/player/model/usePlayer";
import { saveResumePosition } from "../../src/features/player/api";
import { playerCurrentTimeAtom, playerDurationAtom } from "../../src/features/player/model/atoms";
import type { Track, Work, WorkSummary } from "../../src/entities/work/model";

vi.mock("../../src/features/player/api", () => ({
  saveResumePosition: vi.fn(() => Promise.resolve()),
  updateLastPlayed: vi.fn(() => Promise.resolve()),
}));

class FakeAudio extends EventTarget {
  currentTime = 0;
  duration = 0;
  error: MediaError | null = null;
  playbackRate = 1;
  readyState = 0;
  private _src = "";
  readonly srcAssignments: string[] = [];
  volume = 1;

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    this.srcAssignments.push(value);
  }

  play = vi.fn(() => {
    if (nextPlayError) {
      return Promise.reject(nextPlayError);
    }
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });

  pause = vi.fn(() => {
    this.dispatchEvent(new Event("pause"));
  });
}

const audioInstances: FakeAudio[] = [];
let nextPlayError: unknown = null;

function installFakeAudio() {
  vi.stubGlobal(
    "Audio",
    vi.fn(function FakeAudioConstructor() {
      const audio = new FakeAudio();
      audioInstances.push(audio);
      return audio;
    }) as unknown as typeof Audio,
  );
}

function latestAudio() {
  const audio = audioInstances.at(-1);
  if (!audio) throw new Error("FakeAudio was not created");
  return audio;
}

function makeWrapper({ strict = false }: { strict?: boolean } = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const store = useMemo(() => createStore(), []);
    const tree = createElement(JotaiProvider, { store }, children);
    return strict ? createElement(StrictMode, null, tree) : tree;
  };
}

function usePlayerWithClock() {
  const player = usePlayer();
  const currentTime = useAtomValue(playerCurrentTimeAtom);
  const duration = useAtomValue(playerDurationAtom);
  return { player, currentTime, duration };
}

const track: Track = {
  title: "Track 1",
  file: "audio/track-1.wav",
};

const work: WorkSummary = {
  id: "work-1",
  title: "Work 1",
  coverImage: null,
  status: "ok",
  physicalPath: "/audio/work-1",
  totalDurationSec: 120,
  addedAt: "2026-01-01T00:00:00.000Z",
  errorMessage: null,
  urls: [],
  tags: [],
  trackCount: 1,
  bookmarked: false,
  lastPlayedAt: null,
};

beforeEach(() => {
  audioInstances.length = 0;
  nextPlayError = null;
  installFakeAudio();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("formatTime", () => {
  it("formats 0 seconds", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("formats seconds only", () => {
    expect(formatTime(45)).toBe("0:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatTime(125)).toBe("2:05");
  });

  it("formats hours", () => {
    expect(formatTime(3661)).toBe("1:01:01");
  });

  it("handles NaN", () => {
    expect(formatTime(NaN)).toBe("0:00");
  });

  it("handles Infinity", () => {
    expect(formatTime(Infinity)).toBe("0:00");
  });
});

describe("formatDuration", () => {
  it("formats 0", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("delegates to formatTime", () => {
    expect(formatDuration(90)).toBe("1:30");
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats KB", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats MB", () => {
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

describe("usePlayer audio engine lifecycle", () => {
  it("keeps audio callbacks alive after StrictMode effect cleanup and remount", async () => {
    const { result } = renderHook(() => usePlayerWithClock(), {
      wrapper: makeWrapper({ strict: true }),
    });

    await waitFor(() => expect(audioInstances.length).toBeGreaterThanOrEqual(1));

    act(() => {
      result.current.player.play(work, [track]);
    });

    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());

    act(() => {
      const audio = latestAudio();
      audio.currentTime = 42;
      audio.duration = 120;
      audio.dispatchEvent(new Event("timeupdate"));
      audio.dispatchEvent(new Event("durationchange"));
      audio.dispatchEvent(new Event("pause"));
    });

    expect(result.current.currentTime).toBe(42);
    expect(result.current.duration).toBe(120);
    expect(result.current.player.state.isPlaying).toBe(false);
  });

  it("sets playback error and resets isPlaying when audio.play rejects", async () => {
    nextPlayError = new DOMException("User activation required", "NotAllowedError");

    const { result } = renderHook(() => usePlayerWithClock(), {
      wrapper: makeWrapper(),
    });

    act(() => {
      result.current.player.play(work, [track]);
    });

    await waitFor(() => {
      expect(result.current.player.state.playbackError).toMatchObject({
        source: "play",
        name: "NotAllowedError",
        message: "User activation required",
      });
    });
    expect(result.current.player.state.isPlaying).toBe(false);
  });

  it("区間トラックの atom とシークをトラック相対時間で扱う", async () => {
    const segment: Track = { ...track, start: 30, end: 90 };
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, [segment]));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());

    act(() => {
      const audio = latestAudio();
      audio.duration = 120;
      audio.dispatchEvent(new Event("durationchange"));
      audio.currentTime = 45;
      audio.dispatchEvent(new Event("timeupdate"));
    });

    expect(result.current.duration).toBe(60);
    expect(result.current.currentTime).toBe(15);

    act(() => result.current.player.seek(20));
    expect(latestAudio().currentTime).toBe(50);

    act(() => result.current.player.seek(-10));
    expect(latestAudio().currentTime).toBe(30);

    act(() => result.current.player.seek(100));
    expect(latestAudio().currentTime).toBe(90);
  });

  it("区間終端を一度だけ通常のトラック終了として扱う", async () => {
    const tracks: Track[] = [
      { ...track, start: 30, end: 90 },
      { title: "Track 2", file: "audio/track-2.wav" },
    ];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, tracks));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());

    act(() => {
      const audio = latestAudio();
      audio.duration = 90;
      audio.currentTime = 90;
      audio.dispatchEvent(new Event("timeupdate"));
      audio.dispatchEvent(new Event("ended"));
    });

    await waitFor(() => expect(result.current.player.state.currentTrackIndex).toBe(1));
  });

  it("loop 有効時は区間トラックの先頭へ戻って再生を続ける", async () => {
    const segment: Track = { ...track, start: 30, end: 90 };
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, [segment]));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalledTimes(1));
    act(() => result.current.player.setLoop(true));

    act(() => {
      latestAudio().duration = 120;
      latestAudio().currentTime = 90;
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });

    expect(latestAudio().currentTime).toBe(30);
    expect(latestAudio().play).toHaveBeenCalledTimes(2);
    expect(result.current.player.state.currentTrackIndex).toBe(0);
    expect(result.current.player.state.isPlaying).toBe(true);
  });

  it("loop 有効時は通常トラックの先頭へ戻って再生を続ける", async () => {
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, [track]));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalledTimes(1));
    act(() => result.current.player.setLoop(true));

    act(() => {
      latestAudio().duration = 120;
      latestAudio().currentTime = 120;
      latestAudio().dispatchEvent(new Event("ended"));
    });

    expect(latestAudio().currentTime).toBe(0);
    expect(latestAudio().play).toHaveBeenCalledTimes(2);
    expect(result.current.player.state.currentTrackIndex).toBe(0);
    expect(result.current.player.state.isPlaying).toBe(true);
  });

  it("最終区間の終端から戻って再生した場合も終了検知を再武装する", async () => {
    const segment: Track = { ...track, start: 30, end: 90 };
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, [segment]));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());

    act(() => {
      const audio = latestAudio();
      audio.duration = 120;
      audio.currentTime = 90;
      audio.dispatchEvent(new Event("timeupdate"));
    });
    expect(result.current.player.state.isPlaying).toBe(false);
    expect(latestAudio().pause).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.player.seek(10);
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });
    expect(result.current.currentTime).toBe(10);

    act(() => result.current.player.togglePlay());
    expect(result.current.player.state.isPlaying).toBe(true);

    act(() => {
      latestAudio().currentTime = 90;
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });
    expect(result.current.player.state.isPlaying).toBe(false);
    expect(latestAudio().pause).toHaveBeenCalledTimes(2);
  });

  it("A-B 点をトラック相対時間で保持して絶対時刻へシークする", async () => {
    const segment: Track = { ...track, start: 30, end: 90 };
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, [segment]));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());

    act(() => {
      latestAudio().duration = 120;
      latestAudio().currentTime = 40;
      result.current.player.setABPoint("a");
    });
    act(() => {
      latestAudio().currentTime = 50;
      result.current.player.setABPoint("b");
    });

    expect(result.current.player.state.abRepeat).toEqual({ a: 10, b: 20 });

    act(() => {
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });
    expect(latestAudio().currentTime).toBe(40);
    expect(result.current.currentTime).toBe(10);
  });

  it("nextTrack と prevTrack はトラックを移動して A-B リピートを解除する", async () => {
    const tracks: Track[] = [
      track,
      { title: "Track 2", file: "audio/track-2.wav" },
      { title: "Track 3", file: "audio/track-3.wav" },
    ];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, tracks, 1));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    act(() => {
      latestAudio().currentTime = 10;
      result.current.player.setABPoint("a");
    });

    act(() => result.current.player.nextTrack());
    expect(result.current.player.state.currentTrackIndex).toBe(2);
    expect(result.current.player.state.abRepeat).toEqual({ a: null, b: null });

    act(() => {
      latestAudio().currentTime = 20;
      result.current.player.setABPoint("a");
      result.current.player.prevTrack();
    });
    expect(result.current.player.state.currentTrackIndex).toBe(1);
    expect(result.current.player.state.abRepeat).toEqual({ a: null, b: null });
  });

  it("nextTrack と prevTrack は末尾と先頭を越えず A-B リピートも維持する", async () => {
    const tracks: Track[] = [track, { title: "Track 2", file: "audio/track-2.wav" }];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, tracks));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().duration = 120;
    act(() => {
      latestAudio().currentTime = 10;
      result.current.player.setABPoint("a");
    });
    act(() => result.current.player.prevTrack());
    expect(result.current.player.state.currentTrackIndex).toBe(0);
    expect(result.current.player.state.abRepeat).toEqual({ a: 10, b: null });

    act(() => result.current.player.setTrackIndex(1));
    act(() => {
      latestAudio().currentTime = 20;
      result.current.player.setABPoint("a");
    });
    act(() => result.current.player.nextTrack());
    expect(result.current.player.state.currentTrackIndex).toBe(1);
    expect(result.current.player.state.abRepeat).toEqual({ a: 20, b: null });
  });

  it("setTrackIndex は指定位置へ移動して A-B リピートを解除する", async () => {
    const tracks: Track[] = [track, { title: "Track 2", file: "audio/track-2.wav" }];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, tracks));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    act(() => {
      latestAudio().currentTime = 10;
      result.current.player.setABPoint("a");
    });
    act(() => result.current.player.setTrackIndex(1));

    expect(result.current.player.state.currentTrackIndex).toBe(1);
    expect(result.current.player.state.abRepeat).toEqual({ a: null, b: null });
  });

  it("同一ファイルのトラック切替では再ロードせず開始位置へシークする", async () => {
    const tracks: Track[] = [
      { ...track, start: 0, end: 30 },
      { title: "Track 2", file: track.file, start: 30, end: 60 },
    ];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, tracks));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().duration = 60;
    vi.mocked(saveResumePosition).mockClear();

    act(() => result.current.player.nextTrack());
    await waitFor(() => expect(latestAudio().currentTime).toBe(30));

    expect(latestAudio().srcAssignments).toHaveLength(1);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.duration).toBe(30);
    expect(result.current.player.state.isPlaying).toBe(true);
    expect(saveResumePosition).toHaveBeenCalledWith(work.id, 0, 0);
  });

  it("一時停止中の同一ファイル切替では位置だけを変える", async () => {
    const tracks: Track[] = [
      { ...track, start: 0, end: 30 },
      { title: "Track 2", file: track.file, start: 30, end: 60 },
    ];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, tracks));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().duration = 60;
    act(() => result.current.player.togglePlay());
    expect(result.current.player.state.isPlaying).toBe(false);
    latestAudio().play.mockClear();

    act(() => result.current.player.setTrackIndex(1));
    await waitFor(() => expect(latestAudio().currentTime).toBe(30));

    expect(latestAudio().srcAssignments).toHaveLength(1);
    expect(latestAudio().play).not.toHaveBeenCalled();
    expect(result.current.player.state.isPlaying).toBe(false);
  });

  it("同一ファイルの仮想終端では停止せず次トラックへシークする", async () => {
    const tracks: Track[] = [
      { ...track, start: 0, end: 30 },
      { title: "Track 2", file: track.file, start: 30, end: 60 },
    ];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, tracks));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());

    act(() => {
      latestAudio().duration = 60;
      latestAudio().currentTime = 30;
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });
    await waitFor(() => expect(result.current.player.state.currentTrackIndex).toBe(1));

    expect(latestAudio().pause).not.toHaveBeenCalled();
    expect(latestAudio().currentTime).toBe(30);
    expect(latestAudio().srcAssignments).toHaveLength(1);
    expect(result.current.player.state.isPlaying).toBe(true);
  });

  it("同一ファイル切替でも pending resume の位置を優先する", async () => {
    const tracks: Track[] = [
      { ...track, start: 0, end: 30 },
      { title: "Track 2", file: track.file, start: 30, end: 60 },
    ];
    const resumableWork: Work = {
      ...work,
      defaultPlaylist: "default",
      createdAt: null,
      playlists: [{ name: "default", tracks }],
      resumePosition: 45,
      resumeTrackIndex: 1,
    };
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, tracks));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().duration = 60;

    act(() => result.current.player.playWithResume(resumableWork));
    await waitFor(() => expect(latestAudio().currentTime).toBe(45));

    expect(latestAudio().srcAssignments).toHaveLength(1);
    expect(result.current.currentTime).toBe(15);
    expect(result.current.duration).toBe(30);
  });

  it("異なるファイルのトラック切替では従来どおり再ロードする", async () => {
    const tracks: Track[] = [
      { ...track, start: 0, end: 30 },
      { title: "Track 2", file: "audio/track-2.wav", start: 0, end: 45 },
    ];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, tracks));
    await waitFor(() => expect(latestAudio().srcAssignments).toHaveLength(1));

    act(() => result.current.player.nextTrack());
    await waitFor(() => expect(latestAudio().srcAssignments).toHaveLength(2));

    expect(latestAudio().srcAssignments[1]).toContain("audio/track-2.wav");
  });

  it("同じファイル名でも作品が異なれば再ロードする", async () => {
    const otherWork: WorkSummary = { ...work, id: "work-2", title: "Work 2" };
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, [track]));
    await waitFor(() => expect(latestAudio().srcAssignments).toHaveLength(1));

    act(() => result.current.player.play(otherWork, [track]));
    await waitFor(() => expect(latestAudio().srcAssignments).toHaveLength(2));

    expect(latestAudio().srcAssignments[1]).toContain("/work-2/");
  });

  it("stop は絶対時刻の resumePosition を保存して再生 state を初期化する", async () => {
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, [track]));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().currentTime = 42;
    vi.mocked(saveResumePosition).mockClear();

    act(() => result.current.player.stop());

    expect(saveResumePosition).toHaveBeenCalledWith(work.id, 42, 0);
    expect(result.current.player.state).toMatchObject({
      isPlaying: false,
      currentWork: null,
      tracks: [],
      currentTrackIndex: -1,
    });
  });

  it("seekRelative は区間相対の現在位置から移動して区間内へクランプする", async () => {
    const segment: Track = { ...track, start: 30, end: 90 };
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, [segment]));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().duration = 120;

    latestAudio().currentTime = 50;
    act(() => result.current.player.seekRelative(10));
    expect(latestAudio().currentTime).toBe(60);

    act(() => result.current.player.seekRelative(-100));
    expect(latestAudio().currentTime).toBe(30);

    latestAudio().currentTime = 80;
    act(() => result.current.player.seekRelative(100));
    expect(latestAudio().currentTime).toBe(90);
  });

  it("既存形式の絶対 resumePosition を区間トラック内へ復元する", async () => {
    const segment: Track = { ...track, start: 30, end: 90 };
    const resumableWork: Work = {
      ...work,
      defaultPlaylist: "default",
      createdAt: null,
      playlists: [{ name: "default", tracks: [segment] }],
      resumePosition: 45,
      resumeTrackIndex: 0,
    };
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.playWithResume(resumableWork));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());

    act(() => {
      latestAudio().duration = 120;
      latestAudio().dispatchEvent(new Event("loadedmetadata"));
      latestAudio().dispatchEvent(new Event("durationchange"));
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });

    expect(latestAudio().currentTime).toBe(45);
    expect(result.current.currentTime).toBe(15);
    expect(result.current.duration).toBe(60);
  });
});
