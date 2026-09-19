import { createElement, useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useABHandleDrag } from "../../src/features/player/ui/useABHandleDrag";

function TestHandle({ onSet = vi.fn() }: { onSet?: (time: number) => void }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const drag = useABHandleDrag({ trackRef, duration: 100, onSet });
  return createElement(
    "div",
    { ref: trackRef },
    createElement("div", {
      "data-testid": "handle",
      "data-dragging": drag.dragging,
      onPointerDown: drag.onPointerDown,
      onPointerMove: drag.onPointerMove,
      onPointerUp: drag.onPointerUp,
    }),
  );
}

describe("useABHandleDrag の主ボタン判定", () => {
  it("主ボタンのpointerdownでdragが始まる", () => {
    const onSet = vi.fn();
    render(createElement(TestHandle, { onSet }));
    const handle = screen.getByTestId("handle");

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 10, button: 0 });
    expect(handle).toHaveAttribute("data-dragging", "true");
    expect(onSet).toHaveBeenCalled();
  });

  it("中央・右クリックのpointerdownではdragが始まらない", () => {
    const onSet = vi.fn();
    render(createElement(TestHandle, { onSet }));
    const handle = screen.getByTestId("handle");

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 10, button: 1 });
    expect(handle).toHaveAttribute("data-dragging", "false");
    expect(onSet).not.toHaveBeenCalled();

    fireEvent.pointerDown(handle, { pointerId: 2, clientX: 10, button: 2 });
    expect(handle).toHaveAttribute("data-dragging", "false");
    expect(onSet).not.toHaveBeenCalled();
  });
});
