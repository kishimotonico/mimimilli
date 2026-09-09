import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePreviewOverlayMode } from "../../src/features/library/model/usePreviewOverlayMode";
import { clearResizeObservers, getResizeObservers } from "./setup";

function Probe() {
  const { ref, isOverlay } = usePreviewOverlayMode();
  return (
    <div ref={ref} data-testid="results">
      {isOverlay ? "overlay" : "inline"}
    </div>
  );
}

function flushWidth(width: number) {
  const [observer] = getResizeObservers();
  const target = screen.getByTestId("results");
  act(() => {
    observer?.flush([{ target, contentRect: new DOMRectReadOnly(0, 0, width, 0) }]);
  });
}

describe("usePreviewOverlayMode（TASK-438）", () => {
  beforeEach(() => {
    // tokens.css相当。テストでも実際のトークンと同じ値を使い、閾値320+360=680pxを固定しない。
    document.documentElement.style.setProperty("--lib-results-list-min-w", "320px");
    document.documentElement.style.setProperty("--lib-results-preview-min-w", "360px");
  });

  afterEach(() => {
    clearResizeObservers();
    document.documentElement.style.removeProperty("--lib-results-list-min-w");
    document.documentElement.style.removeProperty("--lib-results-preview-min-w");
  });

  it("一覧最低幅+プレビュー最低幅を下回るとoverlayに切り替わる", () => {
    render(<Probe />);
    flushWidth(600);
    expect(screen.getByTestId("results")).toHaveTextContent("overlay");
  });

  it("閾値以上ではinlineのまま", () => {
    render(<Probe />);
    flushWidth(800);
    expect(screen.getByTestId("results")).toHaveTextContent("inline");
  });

  it("閾値ちょうどではinline（未満のときだけoverlay）", () => {
    render(<Probe />);
    flushWidth(680);
    expect(screen.getByTestId("results")).toHaveTextContent("inline");
  });
});
