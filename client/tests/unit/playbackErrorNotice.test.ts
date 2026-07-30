import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

    const notice = screen.getByText("ブラウザにより再生がブロックされました");
    expect(notice.tagName).toBe("OUTPUT");
    expect(notice).toHaveClass("test-error");
    expect(notice).toHaveAttribute("title", "play() failed (NotAllowedError)");
  });
});
