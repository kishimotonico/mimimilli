import { createElement } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePopupDrag } from "../../src/features/player/model/usePopupDrag";

const { start } = vi.hoisted(() => ({ start: vi.fn() }));

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useDragControls: () => ({ start }),
  };
});

function Host() {
  const drag = usePopupDrag();
  return createElement(
    "div",
    { ref: drag.popupRef, onPointerDown: drag.onPointerDown },
    createElement("button", { type: "button" }, "中のボタン"),
  );
}

describe("usePopupDrag", () => {
  it("ポップアップ内の余白からはドラッグを始め、ボタンからは始めない", () => {
    start.mockClear();
    const { getByText } = render(createElement(Host));
    const surface = getByText("中のボタン").parentElement!;
    fireEvent.pointerDown(surface, { button: 0 });
    expect(start).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(getByText("中のボタン"), { button: 0 });
    expect(start).toHaveBeenCalledTimes(1);
  });
});
