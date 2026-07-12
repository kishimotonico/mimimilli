// useDialogModal（TASK-29: モーダル基盤の共通化）の単体テスト。
// jsdom は <dialog> の showModal/close を実装していないため、テストに必要な分だけ差し替える。
import { createElement, useRef } from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDialogModal } from "../../src/shared/ui/useDialogModal";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(() => {
  cleanup();
});

function TestDialog({
  onClose,
  useInitialFocus,
}: {
  onClose: () => void;
  useInitialFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({
    onClose,
    initialFocusRef: useInitialFocus ? inputRef : undefined,
  });

  return createElement(
    "dialog",
    {
      ref: dialogRef,
      "data-testid": "dialog",
      onCancel: handleCancel,
      onClick: (e: React.MouseEvent<HTMLDialogElement>) => handleBackdropClick(e, onClose),
    },
    createElement("input", { ref: inputRef, "data-testid": "input" }),
    createElement("div", { "data-testid": "content" }, "content"),
  );
}

describe("useDialogModal", () => {
  it("マウント時に showModal を呼ぶ", () => {
    render(createElement(TestDialog, { onClose: vi.fn() }));
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
  });

  it("initialFocusRef があればその要素にフォーカスする", () => {
    render(createElement(TestDialog, { onClose: vi.fn(), useInitialFocus: true }));
    expect(document.activeElement).toHaveAttribute("data-testid", "input");
  });

  it("initialFocusRef がなければ dialog 自身にフォーカスする", () => {
    // jsdom は showModal 時のブラウザ標準フォーカス委譲（dialog自身を暗黙的にfocusable化する処理）を
    // 実装していないため、tabIndex を明示してフックが dialog へ .focus() しているかだけを検証する。
    function TabbableDialog({ onClose }: { onClose: () => void }) {
      const { dialogRef } = useDialogModal({ onClose });
      return createElement("dialog", {
        ref: dialogRef,
        "data-testid": "dialog",
        tabIndex: -1,
      });
    }
    const { getByTestId } = render(createElement(TabbableDialog, { onClose: vi.fn() }));
    expect(document.activeElement).toBe(getByTestId("dialog"));
  });

  it("アンマウント時に close を呼び、直前のフォーカスへ戻す", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();

    const { unmount } = render(createElement(TestDialog, { onClose: vi.fn() }));
    unmount();

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(button);
    button.remove();
  });

  it("cancel イベントは既定動作を止めて onClose を呼ぶ", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(createElement(TestDialog, { onClose }));
    const dialog = getByTestId("dialog");

    const event = fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    // event が false を返すのは preventDefault が呼ばれた（既定のクローズ動作を止めた）証拠
    expect(event).toBe(false);
  });

  it("backdrop（dialog自身）クリックで onClose を呼ぶが、中身のクリックでは呼ばない", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(createElement(TestDialog, { onClose }));

    fireEvent.click(getByTestId("content"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(getByTestId("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shouldClose が false を返すときはbackdropクリックでも閉じない", () => {
    const onClose = vi.fn();
    function ShouldNotClose() {
      const { dialogRef, handleBackdropClick } = useDialogModal({ onClose });
      return createElement("dialog", {
        ref: dialogRef,
        "data-testid": "dialog",
        onClick: (e: React.MouseEvent<HTMLDialogElement>) =>
          handleBackdropClick(e, onClose, () => false),
      });
    }
    const { getByTestId } = render(createElement(ShouldNotClose));
    fireEvent.click(getByTestId("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
