import { createElement, useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useNowPlayingImmersiveShell } from "../../src/features/player/model/useNowPlayingImmersiveShell";

function Host({ active }: { active: boolean }) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  useNowPlayingImmersiveShell(active, toggleRef);
  return createElement("button", { ref: toggleRef, type: "button" }, "toggle");
}

describe("useNowPlayingImmersiveShell", () => {
  let frame: HTMLDivElement;
  let alreadyInert: HTMLElement;
  let plainSibling: HTMLElement;

  beforeEach(() => {
    frame = document.createElement("div");
    frame.className = "mle-frame";
    alreadyInert = document.createElement("div");
    alreadyInert.setAttribute("inert", "");
    plainSibling = document.createElement("div");
    const main = document.createElement("main");
    frame.append(alreadyInert, plainSibling, main);
    document.body.appendChild(frame);
  });

  afterEach(() => {
    cleanup();
    frame.remove();
  });

  it("没入開始前からinertだった兄弟要素は、終了後もinertのまま残す", () => {
    const { rerender } = render(createElement(Host, { active: true }));

    expect(plainSibling).toHaveAttribute("inert");

    act(() => {
      rerender(createElement(Host, { active: false }));
    });

    expect(alreadyInert).toHaveAttribute("inert");
    expect(plainSibling).not.toHaveAttribute("inert");
  });
});
