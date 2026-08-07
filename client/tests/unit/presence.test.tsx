import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Presence from "../../src/shared/ui/Presence";
import { usePresence } from "../../src/shared/ui/usePresence";

function PresenceProbe({ show, skipInitial }: { show: boolean; skipInitial?: boolean }) {
  const { mounted, phase } = usePresence(show, { skipInitial, durationMs: 150 });
  if (!mounted) return null;
  return <div data-testid="probe" data-phase={phase} />;
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
