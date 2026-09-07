import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AudioEngineError } from "../../src/features/player/model/audioEngine";
import PlaybackErrorNotice from "../../src/features/player/ui/PlaybackErrorNotice";

const playbackError: AudioEngineError = {
  source: "play",
  name: "NotAllowedError",
  message: "play() failed",
};

describe("PlaybackErrorNotice", () => {
  it("error が null のときは何も描画しない", () => {
    const { container } = render(createElement(PlaybackErrorNotice, { error: null }));
    expect(container).toBeEmptyDOMElement();
  });

  it("error があるときラベルと詳細 title を表示する", () => {
    render(createElement(PlaybackErrorNotice, { error: playbackError, className: "test-error" }));

    const label = screen.getByText("ブラウザにより再生がブロックされました");
    const notice = label.closest("output");
    expect(notice).not.toBeNull();
    expect(notice).toHaveClass("test-error");
    expect(notice).toHaveAttribute("title", "play() failed (NotAllowedError)");
  });

  it("onRetry/onDismissを渡すと再試行・閉じるボタンを表示する", () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    render(
      createElement(PlaybackErrorNotice, {
        error: playbackError,
        onRetry,
        onDismiss,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
