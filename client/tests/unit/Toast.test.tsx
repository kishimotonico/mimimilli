import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Toast from "../../src/shared/ui/Toast";

describe("Toast", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("popover=manual で top layer に載せ、メッセージ表示時に showPopover を呼ぶ", () => {
    const showPopover = vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});

    render(<Toast message="ライブラリのエクスポートに失敗しました" onDismiss={() => {}} />);

    const popover = document.body.querySelector("[popover='manual']");
    expect(popover).toBeTruthy();
    expect(screen.getByText("ライブラリのエクスポートに失敗しました")).toBeTruthy();
    expect(showPopover).toHaveBeenCalled();
  });

  it("非表示時は hidePopover を呼ぶ", () => {
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    const hidePopover = vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});

    const { rerender } = render(<Toast message="エラー" onDismiss={() => {}} />);
    rerender(<Toast message={null} onDismiss={() => {}} />);
    expect(hidePopover).toHaveBeenCalled();
  });
});
