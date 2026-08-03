import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlayerDock from "../../src/features/player/ui/PlayerDock";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { playerCoreAtom, playerUiModeAtom } from "../../src/features/player/model/atoms";
import { PLAYER_CORE_INITIAL } from "../../src/features/player/model/playerController";
import Presence from "../../src/shared/ui/Presence";
import { usePresence } from "../../src/shared/ui/usePresence";

vi.mock("../../src/features/player/ui/BarContent", () => ({
  default: ({ onSwitchToPopup }: { onSwitchToPopup: () => void }) => (
    <button type="button" onClick={onSwitchToPopup}>
      ポップアップへ
    </button>
  ),
}));

vi.mock("../../src/features/player/ui/PopupContent", () => ({
  default: ({ onFold }: { onFold: () => void }) => (
    <button type="button" onClick={onFold}>
      バーへ
    </button>
  ),
}));

vi.mock("../../src/features/player/model/usePlayerActions", () => ({
  usePlayerActions: () => ({
    togglePlay: vi.fn(),
    nextTrack: vi.fn(),
    prevTrack: vi.fn(),
    seek: vi.fn(),
    seekRelative: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    setLoop: vi.fn(),
    setPlaybackRate: vi.fn(),
    setShowFullPlayer: vi.fn(),
  }),
}));

function PresenceProbe({ show, skipInitial }: { show: boolean; skipInitial?: boolean }) {
  const { mounted, phase } = usePresence(show, { skipInitial, durationMs: 150 });
  if (!mounted) return null;
  return <div data-testid="probe" data-phase={phase} />;
}

function renderPlayerDock(uiMode: "bar" | "popup" = "bar") {
  const store = createStore();
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
  store.set(playerUiModeAtom, uiMode);
  return render(
    <JotaiProvider store={store}>
      <LibraryNavigationProvider>
        <PlayerDock />
      </LibraryNavigationProvider>
    </JotaiProvider>,
  );
}

describe("usePresence", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("初回 show=true かつ skipInitial=false では enter から shown へ遷移する", async () => {
    vi.useFakeTimers();

    render(<PresenceProbe show />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-phase", "enter");

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByTestId("probe")).toHaveAttribute("data-phase", "shown");
  });

  it("skipInitial は初回レンダーで show=true のときだけ enter をスキップする", () => {
    vi.useFakeTimers();

    render(<PresenceProbe show skipInitial />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-phase", "shown");
  });

  it("skipInitial は初回スキップ後の再入場では enter する", async () => {
    vi.useFakeTimers();

    const { rerender } = render(<PresenceProbe show skipInitial />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-phase", "shown");

    rerender(<PresenceProbe show={false} skipInitial />);
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    rerender(<PresenceProbe show skipInitial />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-phase", "enter");
  });

  it("初回不在のあと出現した子は skipInitial でも enter する", () => {
    const { rerender } = render(<PresenceProbe show={false} skipInitial />);
    rerender(<PresenceProbe show skipInitial />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-phase", "enter");
  });

  it("高速トグルで退出中に shown へ戻らない", async () => {
    vi.useFakeTimers();

    const { rerender } = render(<PresenceProbe show />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-phase", "enter");

    rerender(<PresenceProbe show={false} />);
    expect(screen.getByTestId("probe")).toHaveAttribute("data-phase", "exit");

    rerender(<PresenceProbe show />);

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    const phase = screen.getByTestId("probe").getAttribute("data-phase");
    expect(phase === "enter" || phase === "shown").toBe(true);
    expect(phase).not.toBe("exit");

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId("probe")).toBeInTheDocument();
  });
});

describe("Presence", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("onExitComplete は退出完了時に呼ばれる", async () => {
    vi.useFakeTimers();
    const onExitComplete = vi.fn();

    const { rerender } = render(
      <Presence show variant="fade" durationMs={150} onExitComplete={onExitComplete}>
        表示
      </Presence>,
    );

    rerender(
      <Presence show={false} variant="fade" durationMs={150} onExitComplete={onExitComplete}>
        表示
      </Presence>,
    );

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(onExitComplete).toHaveBeenCalledTimes(1);
  });
});

describe("PlayerDock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("bar↔popup 切替後に switch 用スタイルが解除される", async () => {
    vi.useFakeTimers();
    renderPlayerDock("bar");

    fireEvent.click(screen.getByRole("button", { name: "ポップアップへ" }));
    expect(document.querySelector(".ml-presence-dock-bar--switch")).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(180);
      await vi.runAllTimersAsync();
    });

    expect(document.querySelector(".ml-presence-dock-bar--switch")).toBeNull();
    expect(screen.getByRole("button", { name: "バーへ" })).toBeInTheDocument();
  });
});
