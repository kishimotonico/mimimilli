import { createElement, useRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PopupMenu } from "../../src/shared/ui/Menu";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNowPlayingImmersiveShell } from "../../src/features/player/model/useNowPlayingImmersiveShell";

function Host({ active, onExit }: { active: boolean; onExit: () => void }) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  useNowPlayingImmersiveShell(active, onExit, toggleRef);
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
    const { rerender } = render(createElement(Host, { active: true, onExit: vi.fn() }));

    expect(plainSibling).toHaveAttribute("inert");

    act(() => {
      rerender(createElement(Host, { active: false, onExit: vi.fn() }));
    });

    expect(alreadyInert).toHaveAttribute("inert");
    expect(plainSibling).not.toHaveAttribute("inert");
  });

  it("開いているポップオーバーがあるEscapeはポップオーバーだけを閉じ、なければ没入を抜ける", () => {
    const onExit = vi.fn();
    function WithMenu() {
      return createElement(
        "div",
        null,
        createElement(Host, { active: true, onExit }),
        createElement(
          PopupMenu,
          { items: [{ key: "a", label: "項目", onSelect: () => {} }], placement: "above" },
          (trigger) => createElement("button", { type: "button", ...trigger }, "速度"),
        ),
      );
    }
    render(createElement(WithMenu));
    fireEvent.click(screen.getByRole("button", { name: "速度" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onExit).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onExit).toHaveBeenCalledOnce();
  });
});
