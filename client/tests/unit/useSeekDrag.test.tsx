import { createElement, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SEEK_KEYBOARD_STEP_SEC, useSeekDrag } from "../../src/features/player/ui/useSeekDrag";

function TestSeek({
  duration,
  initialTime,
  onSeek = vi.fn(),
}: {
  duration: number | null;
  initialTime: number;
  onSeek?: (time: number) => void;
}) {
  const [currentTime, setCurrentTime] = useState(initialTime);
  const seek = useSeekDrag({
    duration,
    currentTime,
    onSeek: (time) => {
      setCurrentTime(time);
      onSeek(time);
    },
  });

  return createElement("div", {
    "data-testid": "seek",
    ref: seek.trackRef,
    ...seek.sliderProps,
  });
}

describe("useSeekDrag", () => {
  it("exposes slider role and aria values when duration is known", () => {
    render(createElement(TestSeek, { duration: 120, initialTime: 30 }));

    const slider = screen.getByRole("slider", { name: "再生位置" });
    expect(slider).toHaveAttribute("aria-valuenow", "30");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "120");
    expect(slider).toHaveAttribute("aria-valuetext", "0:30 / 2:00");
    expect(slider).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("marks the slider disabled when duration is unavailable", () => {
    render(createElement(TestSeek, { duration: null, initialTime: 0 }));

    const slider = screen.getByRole("slider", { name: "再生位置" });
    expect(slider).toHaveAttribute("aria-disabled", "true");
    expect(slider).toHaveAttribute("tabindex", "-1");
  });

  it("seeks by keyboard step with arrow keys", () => {
    const onSeek = vi.fn();
    render(createElement(TestSeek, { duration: 120, initialTime: 30, onSeek }));

    const slider = screen.getByRole("slider", { name: "再生位置" });
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    expect(onSeek).toHaveBeenCalledWith(30 + SEEK_KEYBOARD_STEP_SEC);
    expect(slider).toHaveAttribute("aria-valuenow", String(30 + SEEK_KEYBOARD_STEP_SEC));
  });

  it("seeks to start and end with Home and End", () => {
    const onSeek = vi.fn();
    render(createElement(TestSeek, { duration: 90, initialTime: 45, onSeek }));

    const slider = screen.getByRole("slider", { name: "再生位置" });
    fireEvent.keyDown(slider, { key: "Home" });
    expect(onSeek).toHaveBeenCalledWith(0);

    fireEvent.keyDown(slider, { key: "End" });
    expect(onSeek).toHaveBeenCalledWith(90);
  });

  it("clamps keyboard seek within duration", () => {
    const onSeek = vi.fn();
    render(createElement(TestSeek, { duration: 100, initialTime: 98, onSeek }));

    const slider = screen.getByRole("slider", { name: "再生位置" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onSeek).toHaveBeenCalledWith(100);
  });

  it("does not double-seek with global shortcuts on arrow keys", () => {
    const onSeek = vi.fn();
    const onSeekRelative = vi.fn();
    const globalHandler = (e: KeyboardEvent) => {
      if (e.code === "ArrowRight") onSeekRelative(10);
    };
    window.addEventListener("keydown", globalHandler);

    try {
      render(createElement(TestSeek, { duration: 120, initialTime: 30, onSeek }));
      const slider = screen.getByRole("slider", { name: "再生位置" });
      fireEvent.keyDown(slider, { key: "ArrowRight", code: "ArrowRight" });

      expect(onSeek).toHaveBeenCalledTimes(1);
      expect(onSeek).toHaveBeenCalledWith(30 + SEEK_KEYBOARD_STEP_SEC);
      expect(onSeekRelative).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", globalHandler);
    }
  });

  it("blocks global seek shortcuts when disabled slider receives arrow keys", () => {
    const onSeek = vi.fn();
    const onSeekRelative = vi.fn();
    const globalHandler = (e: KeyboardEvent) => {
      if (e.code === "ArrowRight") onSeekRelative(10);
    };
    window.addEventListener("keydown", globalHandler);

    try {
      render(createElement(TestSeek, { duration: null, initialTime: 0, onSeek }));
      const slider = screen.getByRole("slider", { name: "再生位置" });
      fireEvent.keyDown(slider, { key: "ArrowRight", code: "ArrowRight" });

      expect(onSeek).not.toHaveBeenCalled();
      expect(onSeekRelative).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", globalHandler);
    }
  });
});
