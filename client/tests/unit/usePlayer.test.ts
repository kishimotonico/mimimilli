import { StrictMode, createElement, useState, type ReactNode } from "react";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore, useAtomValue } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerRuntimeProvider } from "../../src/features/player/model/PlayerRuntimeProvider";
import { NOT_REGISTERED_ERROR } from "../../src/features/player/model/playerRuntimeCapabilities";
import { usePlayerRuntime } from "../../src/features/player/model/usePlayer";
import { usePlayerActions } from "../../src/features/player/model/usePlayerActions";
import { usePlayerState } from "../../src/features/player/model/usePlayerState";
import {
  playerCurrentTimeAtom,
  playerDurationAtom,
  playerCoreAtom,
} from "../../src/features/player/model/atoms";
import { saveResumePosition } from "../../src/features/player/api";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import type { ResolvedTrack, Track, Work, WorkSummary } from "../../src/entities/work/model";

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
  private value = "";
  readonly srcAssignments: string[] = [];
  volume = 1;

  // 実ブラウザの HTMLMediaElement 仕様に合わせる: play()/pause() は paused の実際の遷移
  // (true<->false) がある時だけ play/pause イベントを発火する。既に再生中の状態から play() を
  // 呼んでも何も起きない（TASK-128: 区間トラックの reuse 経路で明示選択時にこれを踏む）。
  paused = true;

  get src() {
    return this.value;
  }

  set src(value: string) {
    this.value = value;
    this.srcAssignments.push(value);
    // 実ブラウザの HTMLMediaElement は src 再代入（resource selection algorithm）で
    // 再生位置がリセットされ、pause イベントを発火せずに paused が true に戻る。
    this.currentTime = 0;
    this.paused = true;
  }

  play = vi.fn(() => {
    if (this.paused) {
      this.paused = false;
      this.dispatchEvent(new Event("play"));
    }
    return Promise.resolve();
  });

  pause = vi.fn(() => {
    if (!this.paused) {
      this.paused = true;
      this.dispatchEvent(new Event("pause"));
    }
  });
}

const audioInstances: FakeAudio[] = [];

function latestAudio() {
  const audio = audioInstances.at(-1);
  if (!audio) throw new Error("FakeAudio was not created");
  return audio;
}

function makeWrapper({
  strict = false,
  queryClient = new QueryClient(),
  store = createStore(),
  withRuntime = true,
}: {
  strict?: boolean;
  queryClient?: QueryClient;
  store?: ReturnType<typeof createStore>;
  withRuntime?: boolean;
} = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const inner = withRuntime ? createElement(PlayerRuntimeHarness, null, children) : children;
    const tree = createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store }, createElement(PlayerRuntimeProvider, null, inner)),
    );
    return strict ? createElement(StrictMode, null, tree) : tree;
  };
}

function PlayerRuntimeHarness({ children }: { children: ReactNode }) {
  usePlayerRuntime();
  return children;
}

function usePlayerWithClock() {
  const player = usePlayerActions();
  const state = usePlayerState();
  const currentTime = useAtomValue(playerCurrentTimeAtom);
  const duration = useAtomValue(playerDurationAtom);
  return { player: { ...player, state }, currentTime, duration };
}

const track: Track = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  title: "Track 1",
  file: "audio/track-1.wav",
};
const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const work: WorkSummary = {
  id: "work-1",
  title: "Work 1",
  cover: null,
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
  vi.mocked(saveResumePosition).mockReset();
  vi.mocked(saveResumePosition).mockResolvedValue(undefined);
  vi.stubGlobal(
    "Audio",
    vi.fn(function FakeAudioConstructor() {
      const audio = new FakeAudio();
      audioInstances.push(audio);
      return audio;
    }) as unknown as typeof Audio,
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("usePlayer adapters", () => {
  it("PlayerRuntime 未マウント時は playWithResume / seek が throw する", () => {
    const { result } = renderHook(() => usePlayerActions(), {
      wrapper: makeWrapper({ withRuntime: false }),
    });

    expect(() => result.current.playWithResume(work as Work)).toThrow(NOT_REGISTERED_ERROR);
    expect(() => result.current.seek(10)).toThrow(NOT_REGISTERED_ERROR);
  });

  it("PlayerRuntime ありで再生対象がないときは playWithResume / seek が no-op する", () => {
    const workWithoutResume: Work = {
      ...work,
      defaultPlaylistId: playlistId,
      createdAt: null,
      playlists: [{ id: playlistId, name: "default", tracks: [track] }],
      resume: null,
    };
    const { result } = renderHook(() => usePlayerActions(), { wrapper: makeWrapper() });

    expect(() => result.current.playWithResume(workWithoutResume)).not.toThrow();
    expect(() => result.current.seek(10)).not.toThrow();
  });

  it("StrictMode 下でも capabilities 登録が解除されない", () => {
    const { result } = renderHook(() => usePlayerActions(), {
      wrapper: makeWrapper({ strict: true }),
    });

    expect(() => result.current.seek(10)).not.toThrow(NOT_REGISTERED_ERROR);
  });

  it("PlayerRuntime アンマウントで capabilities 登録が解除される", () => {
    let actions: ReturnType<typeof usePlayerActions> | undefined;
    let hideRuntime: (() => void) | undefined;
    const queryClient = new QueryClient();

    function RuntimeMount() {
      usePlayerRuntime();
      return null;
    }

    function ActionsHost() {
      actions = usePlayerActions();
      return null;
    }

    function TestRoot() {
      const [showRuntime, setShowRuntime] = useState(true);
      hideRuntime = () => setShowRuntime(false);
      return createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          JotaiProvider,
          null,
          createElement(
            PlayerRuntimeProvider,
            null,
            showRuntime ? createElement(RuntimeMount) : null,
            createElement(ActionsHost),
          ),
        ),
      );
    }

    render(createElement(TestRoot));

    expect(() => actions!.seek(10)).not.toThrow(NOT_REGISTERED_ERROR);

    act(() => hideRuntime?.());
    expect(() => actions!.seek(10)).toThrow(NOT_REGISTERED_ERROR);
  });

  it("StrictModeのeffect再実行後もControllerへHTMLAudioイベントを渡す", async () => {
    const { result } = renderHook(() => usePlayerWithClock(), {
      wrapper: makeWrapper({ strict: true }),
    });
    await waitFor(() => expect(audioInstances.length).toBeGreaterThanOrEqual(1));

    act(() => result.current.player.play(work, [track]));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    act(() => {
      latestAudio().currentTime = 42;
      latestAudio().duration = 120;
      latestAudio().dispatchEvent(new Event("timeupdate"));
      latestAudio().dispatchEvent(new Event("durationchange"));
      latestAudio().dispatchEvent(new Event("pause"));
    });

    expect(result.current.currentTime).toBe(42);
    expect(result.current.duration).toBe(120);
    expect(result.current.player.state.isPlaying).toBe(false);
  });

  it("区間トラックの相対時刻をatomへ投影し、シークを絶対時刻へ変換する", async () => {
    const segment: Track = { ...track, start: 30, end: 90 };
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    act(() => result.current.player.play(work, [segment]));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    act(() => {
      latestAudio().duration = 120;
      latestAudio().dispatchEvent(new Event("durationchange"));
      latestAudio().currentTime = 45;
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });

    expect(result.current.duration).toBe(60);
    expect(result.current.currentTime).toBe(15);
    act(() => result.current.player.seek(20));
    expect(latestAudio().currentTime).toBe(50);
  });

  it("区間終端とHTMLAudio endedの重複を一度のトラック終了として扱う", async () => {
    const tracks: Track[] = [
      { ...track, start: 30, end: 90 },
      { title: "Track 2", file: "audio/track-2.wav" },
    ];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
    act(() => result.current.player.play(work, tracks));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());

    act(() => {
      latestAudio().duration = 90;
      latestAudio().currentTime = 90;
      latestAudio().dispatchEvent(new Event("timeupdate"));
      latestAudio().dispatchEvent(new Event("ended"));
    });

    await waitFor(() => expect(result.current.player.state.currentTrackIndex).toBe(1));
  });

  it("loopコマンドを区間先頭への絶対シークと再生継続へ接続する", async () => {
    const segment: Track = { ...track, start: 30, end: 90 };
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
    act(() => result.current.player.play(work, [segment]));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalledOnce());
    act(() => result.current.player.setLoop(true));

    act(() => {
      latestAudio().duration = 120;
      latestAudio().currentTime = 90;
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });

    expect(latestAudio().currentTime).toBe(30);
    expect(latestAudio().play).toHaveBeenCalledTimes(2);
    expect(result.current.player.state.isPlaying).toBe(true);
  });

  it("A-Bリピートの相対位置を区間内の絶対シークへ接続する", async () => {
    const segment: Track = { ...track, start: 30, end: 90 };
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
    act(() => result.current.player.play(work, [segment]));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().duration = 120;

    act(() => {
      latestAudio().currentTime = 40;
      result.current.player.setABPoint("a");
      latestAudio().currentTime = 50;
      result.current.player.setABPoint("b");
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });

    expect(result.current.player.state.abRepeat).toEqual({ a: 10, b: 20 });
    expect(latestAudio().currentTime).toBe(40);
    expect(result.current.currentTime).toBe(10);
  });

  it("B点が区間終端でもA-Bシーク後に次トラックへ進めない", async () => {
    const tracks: Track[] = [
      { ...track, start: 30, end: 90 },
      { title: "Track 2", file: "audio/track-2.wav" },
    ];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
    act(() => result.current.player.play(work, tracks));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().duration = 120;

    act(() => {
      latestAudio().currentTime = 40;
      result.current.player.setABPoint("a");
      latestAudio().currentTime = 90;
      result.current.player.setABPoint("b");
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });

    expect(result.current.player.state.currentTrackIndex).toBe(0);
    expect(result.current.player.state.isPlaying).toBe(true);
    expect(latestAudio().currentTime).toBe(40);
  });

  it("同一assetの次区間があるloopでもplayイベントなしで再生状態と終了検知を維持する", async () => {
    const tracks: Track[] = [
      { ...track, start: 0, end: 30 },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        title: "Track 2",
        file: track.file,
        start: 30,
        end: 60,
      },
    ];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
    act(() => result.current.player.play(work, tracks));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalledOnce());
    act(() => result.current.player.setLoop(true));
    latestAudio().play.mockImplementation(() => Promise.resolve());

    act(() => {
      latestAudio().currentTime = 30;
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });
    expect(latestAudio().play).toHaveBeenCalledTimes(2);

    act(() => {
      latestAudio().currentTime = 30;
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });
    expect(latestAudio().play).toHaveBeenCalledTimes(3);

    act(() => result.current.player.togglePlay());
    expect(latestAudio().pause).toHaveBeenCalledOnce();
    expect(result.current.player.state.isPlaying).toBe(false);
  });

  it("Audioエラー時に直近の相対位置をresumeへ保存する", async () => {
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
    act(() => result.current.player.play(work, [track], 0, playlistId));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().currentTime = 42;
    vi.mocked(saveResumePosition).mockClear();

    act(() => latestAudio().dispatchEvent(new Event("error")));

    expect(result.current.player.state.playbackError).not.toBeNull();
    expect(saveResumePosition).toHaveBeenCalledWith(work.id, {
      playlistId,
      trackId: track.id,
      offsetSec: 42,
    });
  });

  it("作品聴了コマンドをレジュームの先頭リセットとQuery cacheへ接続する", async () => {
    const resumableWork: Work = {
      ...work,
      defaultPlaylistId: playlistId,
      createdAt: null,
      playlists: [{ id: playlistId, name: "default", tracks: [track] }],
      resume: { playlistId, trackId: track.id, offsetSec: 42 },
    };
    const queryClient = new QueryClient();
    queryClient.setQueryData(WORK_QUERY_KEYS.detail(work.id), resumableWork);
    const { result } = renderHook(() => usePlayerWithClock(), {
      wrapper: makeWrapper({ queryClient }),
    });
    act(() => result.current.player.play(work, [track], 0, playlistId));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    vi.mocked(saveResumePosition).mockClear();

    act(() => latestAudio().dispatchEvent(new Event("ended")));

    expect(saveResumePosition).toHaveBeenCalledWith(work.id, {
      playlistId,
      trackId: track.id,
      offsetSec: 0,
    });
    expect(queryClient.getQueryData<Work>(WORK_QUERY_KEYS.detail(work.id))).toMatchObject({
      resume: { playlistId, trackId: track.id, offsetSec: 0 },
    });
  });

  it("Files相当のplaylistなし単発再生では作品聴了としてresumeをリセットしない", async () => {
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
    act(() => result.current.player.play(work, [track], 0, null));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    vi.mocked(saveResumePosition).mockClear();

    act(() => latestAudio().dispatchEvent(new Event("ended")));

    expect(result.current.player.state.isPlaying).toBe(false);
    expect(saveResumePosition).not.toHaveBeenCalled();
  });

  it("同一ファイルのトラック切替では再ロードせず区間先頭へシークする", async () => {
    const tracks: ResolvedTrack[] = [
      { ...track, start: 0, end: 30, durationSec: 30 },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        title: "Track 2",
        file: track.file,
        start: 30,
        end: 60,
        durationSec: 30,
      },
    ];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
    act(() => result.current.player.play(work, tracks, 0, playlistId));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().duration = 60;

    act(() => result.current.player.nextTrack());
    await waitFor(() => expect(latestAudio().currentTime).toBe(30));

    expect(latestAudio().srcAssignments).toHaveLength(1);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.duration).toBe(30);
  });

  it("一時停止中に次のトラックへ切り替えても再生が再開しない（同一ファイルの区間切替）", async () => {
    const tracks: ResolvedTrack[] = [
      { ...track, start: 0, end: 30, durationSec: 30 },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        title: "Track 2",
        file: track.file,
        start: 30,
        end: 60,
        durationSec: 30,
      },
    ];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
    act(() => result.current.player.play(work, tracks, 0, playlistId));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().duration = 60;

    act(() => result.current.player.togglePlay());
    expect(result.current.player.state.isPlaying).toBe(false);
    latestAudio().play.mockClear();

    act(() => result.current.player.nextTrack());
    await waitFor(() => expect(result.current.player.state.currentTrackIndex).toBe(1));

    expect(result.current.player.state.isPlaying).toBe(false);
    expect(latestAudio().play).not.toHaveBeenCalled();
  });

  it("一時停止中でもトラックリストからの明示選択では再生が開始される", async () => {
    const tracks: ResolvedTrack[] = [
      { ...track, start: 0, end: 30, durationSec: 30 },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        title: "Track 2",
        file: track.file,
        start: 30,
        end: 60,
        durationSec: 30,
      },
    ];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
    act(() => result.current.player.play(work, tracks, 0, playlistId));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().duration = 60;

    act(() => result.current.player.togglePlay());
    expect(result.current.player.state.isPlaying).toBe(false);
    latestAudio().play.mockClear();

    act(() => result.current.player.setTrackIndex(1));

    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    expect(result.current.player.state.currentTrackIndex).toBe(1);
  });

  it("再生中の区間トラックを明示選択してもstatusがloadingに固着せずplayingへ収束する（TASK-128）", async () => {
    vi.useFakeTimers();
    try {
      const tracks: ResolvedTrack[] = [
        { ...track, start: 0, end: 30, durationSec: 30 },
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          title: "Track 2",
          file: track.file,
          start: 30,
          end: 60,
          durationSec: 30,
        },
      ];
      const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
      act(() => result.current.player.play(work, tracks, 0, playlistId));
      expect(latestAudio().play).toHaveBeenCalled();
      latestAudio().duration = 60;
      expect(result.current.player.state.status).toBe("playing");

      // 再生中（audio要素はpaused=falseのまま）に、同一ファイル内の別区間を明示選択する。
      act(() => result.current.player.setTrackIndex(1));

      expect(result.current.player.state.currentTrackIndex).toBe(1);
      // 実ブラウザは既に再生中の要素へ play() を呼んでも play イベントを再発火しないため、
      // ここで status が "loading" に固着しないことが本バグの再現ポイント。
      expect(result.current.player.state.status).toBe("playing");

      // status固着が直っていれば、persistTick（5秒間隔のresume保存）も止まらない。
      vi.mocked(saveResumePosition).mockClear();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(saveResumePosition).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("異なるファイルへのトラック切替後に前トラックのplay拒否でerrorにならない", async () => {
    const tracks: ResolvedTrack[] = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        title: "Track A",
        file: "audio/track-a.wav",
        durationSec: 30,
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        title: "Track B",
        file: "audio/track-b.wav",
        durationSec: 30,
      },
    ];
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });

    let rejectFirstPlay: (reason?: unknown) => void = () => {};
    latestAudio().play.mockReturnValueOnce(
      new Promise<void>((_, reject) => {
        rejectFirstPlay = reject;
      }),
    );

    act(() => result.current.player.play(work, tracks, 0, playlistId));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());

    act(() => result.current.player.nextTrack());
    await waitFor(() => expect(latestAudio().srcAssignments).toHaveLength(2));

    rejectFirstPlay(new DOMException("Aborted", "AbortError"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.player.state.status).not.toBe("error");
    expect(result.current.player.state.playbackError).toBeNull();
  });

  it("再生中に同一作品・同一トラックへ再度「最初から再生」すると先頭へシークする", async () => {
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
    act(() => result.current.player.play(work, [track], 0, playlistId));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().currentTime = 42;

    act(() => result.current.player.play(work, [track], 0, playlistId));

    await waitFor(() => expect(latestAudio().currentTime).toBe(0));
  });

  it("レジュームの区間相対offsetをHTMLAudioの絶対時刻へ復元する", async () => {
    const segment: Track = { ...track, start: 30, end: 90 };
    const resumableWork: Work = {
      ...work,
      defaultPlaylistId: playlistId,
      createdAt: null,
      playlists: [{ id: playlistId, name: "default", tracks: [segment] }],
      resume: { playlistId, trackId: segment.id, offsetSec: 15 },
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

  it("stopコマンドを相対resume保存とHTMLAudio停止へ接続する", async () => {
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
    act(() => result.current.player.play(work, [track], 0, playlistId));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());
    latestAudio().currentTime = 42;
    vi.mocked(saveResumePosition).mockClear();

    act(() => result.current.player.stop());

    expect(saveResumePosition).toHaveBeenCalledWith(work.id, {
      playlistId,
      trackId: track.id,
      offsetSec: 42,
    });
    expect(result.current.player.state.currentWork).toBeNull();
  });

  // 実ブラウザではHTMLMediaElementのplay()呼び出しからplayイベント発火まで非同期の間が空き、
  // status: "loading" のレンダーとstatus: "playing" のレンダーが別コミットになる。
  // FakeAudioの既定実装はplay()呼び出しと同期的にイベントを発火するため、この間隔を再現できず
  // loading→playingが1レンダーに畳み込まれてバグを検出できない。play発火をマイクロタスクへ遅延させ、
  // 実機のレンダー分離を模倣する。
  function deferPlayEventToMicrotask(audio: FakeAudio) {
    audio.play = vi.fn(() => {
      if (audio.paused) {
        queueMicrotask(() => {
          audio.paused = false;
          audio.dispatchEvent(new Event("play"));
        });
      }
      return Promise.resolve();
    });
  }

  it("初回再生の開始直後（一時停止/再開なし）からpersistTickの5秒間隔が動作する", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
      deferPlayEventToMicrotask(latestAudio());

      act(() => result.current.player.play(work, [track], 0, playlistId));
      expect(result.current.player.state.status).toBe("loading");

      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.player.state.status).toBe("playing");
      vi.mocked(saveResumePosition).mockClear();

      latestAudio().currentTime = 10;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(saveResumePosition).toHaveBeenCalledWith(work.id, {
        playlistId,
        trackId: track.id,
        offsetSec: 10,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("一時停止中はpersistTickの定期実行が止まる", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
      deferPlayEventToMicrotask(latestAudio());

      act(() => result.current.player.play(work, [track], 0, playlistId));
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.player.state.status).toBe("playing");

      act(() => result.current.player.pause());
      expect(result.current.player.state.status).toBe("paused");
      vi.mocked(saveResumePosition).mockClear();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(saveResumePosition).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("toggleMuteでミュート前の音量を復元する", async () => {
    const { result } = renderHook(() => usePlayerWithClock(), { wrapper: makeWrapper() });
    act(() => result.current.player.play(work, [track], 0, playlistId));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());

    act(() => result.current.player.setVolume(50));
    await waitFor(() => expect(result.current.player.state.volume).toBe(50));

    act(() => result.current.player.toggleMute());
    await waitFor(() => expect(result.current.player.state.volume).toBe(0));

    act(() => result.current.player.toggleMute());
    await waitFor(() => expect(result.current.player.state.volume).toBe(50));
  });

  it("timeupdate では core atom の参照を維持しつつ currentTime を更新する", async () => {
    const store = createStore();
    const { result } = renderHook(() => usePlayerWithClock(), {
      wrapper: makeWrapper({ store }),
    });

    act(() => result.current.player.play(work, [track]));
    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());

    const coreBefore = store.get(playerCoreAtom);
    act(() => {
      latestAudio().currentTime = 12;
      latestAudio().dispatchEvent(new Event("timeupdate"));
    });

    expect(store.get(playerCurrentTimeAtom)).toBe(12);
    expect(store.get(playerCoreAtom)).toBe(coreBefore);

    act(() => result.current.player.setVolume(30));
    await waitFor(() => expect(store.get(playerCoreAtom).volume).toBe(30));
    expect(store.get(playerCoreAtom)).not.toBe(coreBefore);
  });
});
