import { createElement } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGlobalShortcuts } from "../../src/features/player/model/useGlobalShortcuts";

function TestHost({
  onTogglePlay,
  onSeekRelative,
}: {
  onTogglePlay: () => void;
  onSeekRelative: (deltaSec: number) => void;
}) {
  useGlobalShortcuts({ onTogglePlay, onSeekRelative, isActive: true });
  return createElement(
    "div",
    null,
    createElement("button", { type: "button" }, "button"),
    createElement("a", { href: "#" }, "link"),
    createElement("input", { type: "text" }),
    createElement("select", null, createElement("option", null, "opt")),
    createElement("div", { role: "slider", tabIndex: 0 }, "slider"),
    createElement("div", { contentEditable: true }, "editable"),
    createElement("div", { "data-testid": "plain" }, "plain"),
  );
}

describe("useGlobalShortcuts", () => {
  it("フォーカスがボタン・リンク・select・contentEditableにあるときはネイティブ動作を優先しショートカットを発火しない", () => {
    const onTogglePlay = vi.fn();
    const onSeekRelative = vi.fn();
    const { getByRole, getByText } = render(
      createElement(TestHost, { onTogglePlay, onSeekRelative }),
    );

    for (const el of [getByRole("button"), getByRole("link"), getByRole("combobox")]) {
      fireEvent.keyDown(el, { code: "Space" });
      fireEvent.keyDown(el, { code: "ArrowLeft" });
    }
    fireEvent.keyDown(getByText("editable"), { code: "Space" });

    expect(onTogglePlay).not.toHaveBeenCalled();
    expect(onSeekRelative).not.toHaveBeenCalled();
  });

  it("フォーカスがsliderにあるとき、Spaceはトグル＋preventDefaultされ、矢印はスライダー側に委ねグローバル側は無反応", () => {
    const onTogglePlay = vi.fn();
    const onSeekRelative = vi.fn();
    const { getByRole } = render(createElement(TestHost, { onTogglePlay, onSeekRelative }));
    const slider = getByRole("slider");

    const spaceResult = fireEvent.keyDown(slider, { code: "Space", key: " " });
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
    // fireEventの戻り値はpreventDefaultされなかった(=イベントがdispatchDefault可能なまま)場合にtrueになる。
    // ここではpreventDefaultされる（=スクロールしない）ためfalseが正しい。
    expect(spaceResult).toBe(false);

    fireEvent.keyDown(slider, { code: "ArrowLeft", key: "ArrowLeft" });
    expect(onSeekRelative).not.toHaveBeenCalled();
  });

  it("それ以外の要素にフォーカスがあるときは従来どおりショートカットが効く", () => {
    const onTogglePlay = vi.fn();
    const onSeekRelative = vi.fn();
    const { getByTestId } = render(createElement(TestHost, { onTogglePlay, onSeekRelative }));

    fireEvent.keyDown(getByTestId("plain"), { code: "Space" });
    fireEvent.keyDown(getByTestId("plain"), { code: "ArrowRight" });

    expect(onTogglePlay).toHaveBeenCalledTimes(1);
    expect(onSeekRelative).toHaveBeenCalledWith(10);
  });
});
