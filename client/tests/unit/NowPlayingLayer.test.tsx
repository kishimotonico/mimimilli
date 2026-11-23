import { StrictMode, useRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildWork } from "../helpers/builders";
import { mockApi } from "../helpers/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorkResultsDismiss } from "../../src/features/library/ui/useWorkResultsDismiss";
import NowPlayingLayer from "../../src/features/player/ui/NowPlayingLayer";
import { PLAYER_CORE_INITIAL, playerCoreAtom } from "../../src/entities/player/model/atoms";
import { appRouteAtom, appRouteStore } from "../../src/entities/navigation/model/appRouteStore";
import { nowPlayingViewModeAtom } from "../../src/features/player/model/playerPresentationAtoms";
import { seedAppMode, seedRoute } from "../helpers/route";

vi.mock("../../src/entities/player/model/usePlayerActions", () => ({
  usePlayerActions: () => ({
    togglePlay: vi.fn(),
    nextTrack: vi.fn(),
    prevTrack: vi.fn(),
    seek: vi.fn(),
    seekRelative: vi.fn(),
    setVolume: vi.fn(),
    setLoop: vi.fn(),
    setChannelSwap: vi.fn(),
    setPlaybackRate: vi.fn(),
    setTrackIndex: vi.fn(),
    setABPoint: vi.fn(),
    setABPointAt: vi.fn(),
    clearABRepeat: vi.fn(),
    retryPlayback: vi.fn(),
    dismissError: vi.fn(),
  }),
}));

function DismissProbe({ onDeselect }: { onDeselect: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useWorkResultsDismiss(true, onDeselect, ref, "button");
  return <div ref={ref} />;
}

function setup({
  playing,
  canBack = true,
  onDeselect,
}: {
  playing: boolean;
  canBack?: boolean;
  onDeselect?: () => void;
}) {
  mockApi({
    "GET /api/works/:id": buildWork({ id: "work-1", tags: [] }),
    "GET /api/tag-prefixes": [],
  });
  const store = createStore();
  seedAppMode(store, "library");
  store.set(appRouteStore.sync.historyAvailabilityAtom, { canBack, canForward: false });
  seedRoute(store, (route) => ({ ...route, layer: { kind: "nowPlaying" } }));
  if (playing) {
    store.set(playerCoreAtom, {
      ...PLAYER_CORE_INITIAL,
      currentTrackIndex: 0,
      currentWork: {
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
      },
      tracks: [{ id: "track-1", title: "Track 1", file: "audio/track-1.wav" }],
    });
  }
  render(
    <StrictMode>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <JotaiProvider store={store}>
          {onDeselect && <DismissProbe onDeselect={onDeselect} />}
          <NowPlayingLayer onOpenWork={vi.fn()} onTagClick={vi.fn()} />
        </JotaiProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
  return store;
}

describe("NowPlayingLayer", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("再生していないのに層が開いていたら、履歴を1件だけ戻る", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    setup({ playing: false });

    expect(screen.queryByRole("region", { name: "再生中" })).toBeNull();
    expect(back).toHaveBeenCalledOnce();
  });

  it("再生していないのに層が開いていて戻り先が無ければ、置き換えで層を外す", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const store = setup({ playing: false, canBack: false });

    expect(back).not.toHaveBeenCalled();
    expect(store.get(appRouteAtom).layer).toBeNull();
  });

  it("再生中は層を出し、Esc で閉じる（通常表示でも没入でも、没入の設定は変えない）", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const store = setup({ playing: true });
    expect(screen.getByRole("region", { name: "再生中" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "没入モードにする" }));
    expect(store.get(nowPlayingViewModeAtom)).toBe("immersive");

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(back).toHaveBeenCalledOnce();
    expect(store.get(nowPlayingViewModeAtom)).toBe("immersive");
  });

  it("閉じるボタンで閉じる", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    setup({ playing: true });

    fireEvent.click(screen.getByRole("button", { name: "再生中を閉じる" }));
    expect(back).toHaveBeenCalledOnce();
  });

  it("モーダルが開いているあいだの Esc は層を閉じない", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    setup({ playing: true });
    const spy = vi
      .spyOn(document, "querySelector")
      .mockImplementation((selector: string) => (selector === ":modal" ? document.body : null));

    fireEvent.keyDown(document.body, { key: "Escape" });
    spy.mockRestore();
    expect(back).not.toHaveBeenCalled();
  });

  it("速度メニューを開いたEscはメニューだけを閉じ、2回目のEscで層が閉じる", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    setup({ playing: true });

    fireEvent.click(screen.getByTitle("再生速度"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(back).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(back).toHaveBeenCalledOnce();
  });

  it("選択中の作品があるライブラリの上で Esc を押しても、層だけが閉じて選択は残る", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const onDeselect = vi.fn();
    setup({ playing: true, onDeselect });

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(back).toHaveBeenCalledOnce();
    expect(onDeselect).not.toHaveBeenCalled();
  });

  it("開くと閉じるボタンへフォーカスし、閉じると開く前の要素へ戻す（StrictMode でも opener を取り違えない）", () => {
    vi.useFakeTimers();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const store = setup({ playing: true, canBack: false });
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByRole("button", { name: "再生中を閉じる" })).toHaveFocus();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "再生中を閉じる" }));
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(store.get(appRouteAtom).layer).toBeNull();
    expect(opener).toHaveFocus();
    opener.remove();
    vi.useRealTimers();
  });

  it("開く前のフォーカスが body のときは、閉じると ⤢ へ戻す", () => {
    vi.useFakeTimers();
    const entry = document.createElement("button");
    entry.setAttribute("data-np-open", "");
    document.body.append(entry);
    (document.activeElement as HTMLElement | null)?.blur();
    const store = setup({ playing: true, canBack: false });
    act(() => {
      vi.runAllTimers();
    });

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "再生中を閉じる" }));
    });
    act(() => {
      vi.runAllTimers();
    });
    expect(store.get(appRouteAtom).layer).toBeNull();
    expect(entry).toHaveFocus();
    entry.remove();
    vi.useRealTimers();
  });
});
