import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSeekDrag } from "../../src/features/player/ui/useSeekDrag";

function TestSeek({ onSeek = vi.fn() }: { onSeek?: (time: number) => void }) {
  const seek = useSeekDrag({ duration: 120, currentTime: 30, onSeek });
  return createElement("div", {
    "data-testid": "seek",
    "data-dragging": seek.dragging,
    ref: seek.trackRef,
    onPointerDown: seek.onPointerDown,
    onPointerMove: seek.onPointerMove,
    onPointerUp: seek.onPointerUp,
    onPointerCancel: seek.onPointerCancel,
    onLostPointerCapture: seek.onLostPointerCapture,
  });
}

describe("useSeekDrag のpointercancel/lostpointercapture", () => {
  it("pointercancelでdragging状態が固まらず解除される", () => {
    render(createElement(TestSeek));
    const track = screen.getByTestId("seek");

    fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 });
    expect(track).toHaveAttribute("data-dragging", "true");

    fireEvent.pointerCancel(track, { pointerId: 1 });
    expect(track).toHaveAttribute("data-dragging", "false");
  });

  it("pointerup後にlostpointercaptureが遅れて発火しても二重処理でエラーにならない", () => {
    render(createElement(TestSeek));
    const track = screen.getByTestId("seek");

    fireEvent.pointerDown(track, { pointerId: 1, clientX: 10 });
    fireEvent.pointerUp(track, { pointerId: 1, clientX: 10 });
    expect(track).toHaveAttribute("data-dragging", "false");

    expect(() => fireEvent.lostPointerCapture(track, { pointerId: 1 })).not.toThrow();
    expect(track).toHaveAttribute("data-dragging", "false");
  });
});
