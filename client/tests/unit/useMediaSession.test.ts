import { act, renderHook } from "@testing-library/react";
import type { Track, WorkSummary } from "../../src/entities/work/model";
import { useMediaSession } from "../../src/features/player/model/useMediaSession";

type ActionHandler = ((details: MediaSessionActionDetails) => void) | null;

class MediaMetadataMock {
  title = "";
  artist = "";
  album = "";
  artwork: readonly MediaImage[] = [];

  constructor(init: MediaMetadataInit) {
    Object.assign(this, init);
  }
}

function makeWork(): WorkSummary {
  return {
    id: "work-1",
    title: "作品タイトル",
    coverImage: "cover.jpg",
    status: "ok",
    physicalPath: "/works/work-1",
    totalDurationSec: 120,
    addedAt: "2026-07-19T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: ["サークル/星月夜"],
    trackCount: 2,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: { productId: null, lastFetchedAt: null, needsFetch: false },
  };
}

const track: Track = {
  title: "区間トラック",
  file: "voice.mp3",
  start: 60,
  end: 80,
};

describe("useMediaSession", () => {
  const handlers = new Map<MediaSessionAction, ActionHandler>();
  const setActionHandler = vi.fn((action: MediaSessionAction, handler: ActionHandler) => {
    handlers.set(action, handler);
  });
  const setPositionState = vi.fn();
  const mediaSession = {
    metadata: null,
    playbackState: "none",
    setActionHandler,
    setPositionState,
  } as unknown as MediaSession;

  beforeEach(() => {
    handlers.clear();
    setActionHandler.mockClear();
    setPositionState.mockClear();
    Object.assign(mediaSession, { metadata: null, playbackState: "none" });
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: mediaSession,
    });
    vi.stubGlobal("MediaMetadata", MediaMetadataMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "mediaSession");
  });

  it("作品とトラックのメタデータ、相対位置を設定する", () => {
    const work = makeWork();
    renderHook(() =>
      useMediaSession({
        currentWork: work,
        currentTrack: track,
        currentTrackIndex: 0,
        trackCount: 2,
        isPlaying: true,
        playbackRate: 1.25,
        getPosition: () => ({ duration: 20, position: 7, playbackRate: 1.25 }),
        onPlay: vi.fn(),
        onPause: vi.fn(),
        onPreviousTrack: vi.fn(),
        onNextTrack: vi.fn(),
        onSeek: vi.fn(),
        onSeekRelative: vi.fn(),
      }),
    );

    expect(mediaSession.metadata).toEqual(
      expect.objectContaining({
        title: "区間トラック",
        artist: "星月夜",
        album: "作品タイトル",
        artwork: [{ src: "/api/media/cover/work-1?w=512" }],
      }),
    );
    expect(mediaSession.playbackState).toBe("playing");
    expect(setPositionState).toHaveBeenCalledWith({
      duration: 20,
      position: 7,
      playbackRate: 1.25,
    });
  });

  it("操作handlerを配線し、存在しない前後トラックは無効にする", () => {
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const onPreviousTrack = vi.fn();
    const onNextTrack = vi.fn();
    const onSeek = vi.fn();
    const onSeekRelative = vi.fn();

    const { rerender } = renderHook(
      ({ currentTrackIndex }) =>
        useMediaSession({
          currentWork: makeWork(),
          currentTrack: track,
          currentTrackIndex,
          trackCount: 2,
          isPlaying: false,
          playbackRate: 1,
          getPosition: () => ({ duration: 20, position: 5, playbackRate: 1 }),
          onPlay,
          onPause,
          onPreviousTrack,
          onNextTrack,
          onSeek,
          onSeekRelative,
        }),
      { initialProps: { currentTrackIndex: 0 } },
    );

    expect(handlers.get("previoustrack")).toBeNull();
    act(() => handlers.get("play")?.({ action: "play" }));
    act(() => handlers.get("pause")?.({ action: "pause" }));
    act(() => handlers.get("nexttrack")?.({ action: "nexttrack" }));
    act(() => handlers.get("seekbackward")?.({ action: "seekbackward", seekOffset: 4 }));
    act(() => handlers.get("seekforward")?.({ action: "seekforward" }));
    act(() => handlers.get("seekto")?.({ action: "seekto", seekTime: 12 }));

    expect(onPlay).toHaveBeenCalledOnce();
    expect(onPause).toHaveBeenCalledOnce();
    expect(onNextTrack).toHaveBeenCalledOnce();
    expect(onSeekRelative).toHaveBeenNthCalledWith(1, -4);
    expect(onSeekRelative).toHaveBeenNthCalledWith(2, 10);
    expect(onSeek).toHaveBeenCalledWith(12);

    rerender({ currentTrackIndex: 1 });
    expect(handlers.get("previoustrack")).toBe(onPreviousTrack);
    expect(handlers.get("nexttrack")).toBeNull();
  });

  it("停止時にメタデータと位置情報をクリアする", () => {
    const { rerender } = renderHook(
      ({ active }) =>
        useMediaSession({
          currentWork: active ? makeWork() : null,
          currentTrack: active ? track : null,
          currentTrackIndex: active ? 0 : -1,
          trackCount: active ? 2 : 0,
          isPlaying: active,
          playbackRate: 1,
          getPosition: () => (active ? { duration: 20, position: 5, playbackRate: 1 } : null),
          onPlay: vi.fn(),
          onPause: vi.fn(),
          onPreviousTrack: vi.fn(),
          onNextTrack: vi.fn(),
          onSeek: vi.fn(),
          onSeekRelative: vi.fn(),
        }),
      { initialProps: { active: true } },
    );

    setPositionState.mockClear();
    rerender({ active: false });

    expect(mediaSession.metadata).toBeNull();
    expect(mediaSession.playbackState).toBe("none");
    expect(setPositionState).toHaveBeenCalledWith();
    expect(handlers.get("play")).toBeNull();
    expect(handlers.get("pause")).toBeNull();
    expect(handlers.get("seekto")).toBeNull();
  });

  it("MediaSession非対応環境では何もしない", () => {
    Reflect.deleteProperty(navigator, "mediaSession");

    const { result } = renderHook(() =>
      useMediaSession({
        currentWork: makeWork(),
        currentTrack: track,
        currentTrackIndex: 0,
        trackCount: 2,
        isPlaying: true,
        playbackRate: 1,
        getPosition: () => ({ duration: 20, position: 5, playbackRate: 1 }),
        onPlay: vi.fn(),
        onPause: vi.fn(),
        onPreviousTrack: vi.fn(),
        onNextTrack: vi.fn(),
        onSeek: vi.fn(),
        onSeekRelative: vi.fn(),
      }),
    );

    expect(() => result.current()).not.toThrow();
    expect(setActionHandler).not.toHaveBeenCalled();
    expect(setPositionState).not.toHaveBeenCalled();
  });
});
