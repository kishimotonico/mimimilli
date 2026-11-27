// useDialogModalの単体テスト。
// happy-dom は <dialog> の showModal/close を実装していないため、テストに必要な分だけ差し替える。
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
      onClick: (e: React.MouseEvent<HTMLDialogElement>) => handleBackdropClick(e),
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
    // happy-dom は showModal 時のブラウザ標準フォーカス委譲（dialog自身を暗黙的にfocusable化する処理）を
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

  it("末尾要素からTabするとBODYへ落とさず先頭要素へ循環する", () => {
    function FocusTrapDialog({ onClose }: { onClose: () => void }) {
      const { dialogRef } = useDialogModal({ onClose });
      return createElement(
        "dialog",
        { ref: dialogRef, "data-testid": "dialog" },
        createElement("button", { "data-testid": "first" }, "first"),
        createElement("button", { "data-testid": "last" }, "last"),
      );
    }
    const { getByTestId } = render(createElement(FocusTrapDialog, { onClose: vi.fn() }));
    const last = getByTestId("last");
    last.focus();

    const event = fireEvent.keyDown(last, { key: "Tab", bubbles: true, cancelable: true });
    expect(event).toBe(false); // preventDefault された
    expect(document.activeElement).toBe(getByTestId("first"));
  });

  it("ポータルされたメニューの中の Tab は、末尾でも循環させずメニューに任せる", () => {
    function MenuInDialog({ onClose }: { onClose: () => void }) {
      const { dialogRef } = useDialogModal({ onClose });
      return createElement(
        "dialog",
        { ref: dialogRef },
        createElement("button", { "data-testid": "first" }, "first"),
        createElement("div", {
          "data-testid": "menu",
          "data-scope": "menu",
          "data-part": "content",
          tabIndex: 0,
        }),
      );
    }
    const { getByTestId } = render(createElement(MenuInDialog, { onClose: vi.fn() }));
    const menu = getByTestId("menu");
    menu.focus();
    const notPrevented = fireEvent.keyDown(menu, { key: "Tab", bubbles: true, cancelable: true });
    expect(notPrevented).toBe(true);
    expect(document.activeElement).toBe(menu);
  });

  it("inertの中や非表示の要素は循環の末尾に数えず、最後に辿れる要素から先頭へ回る", () => {
    function InertTailDialog({ onClose }: { onClose: () => void }) {
      const { dialogRef } = useDialogModal({ onClose });
      return createElement(
        "dialog",
        { ref: dialogRef },
        createElement("button", { "data-testid": "first" }, "first"),
        createElement("button", { "data-testid": "last" }, "last"),
        createElement("div", { inert: true }, createElement("button", null, "hidden")),
        createElement("div", { style: { display: "none" } }, createElement("button", null, "gone")),
      );
    }
    const { getByTestId } = render(createElement(InertTailDialog, { onClose: vi.fn() }));
    const last = getByTestId("last");
    last.focus();
    const event = fireEvent.keyDown(last, { key: "Tab", bubbles: true, cancelable: true });
    expect(event).toBe(false);
    expect(document.activeElement).toBe(getByTestId("first"));
  });

  it("先頭要素からShift+TabするとBODYへ落とさず末尾要素へ循環する", () => {
    function FocusTrapDialog({ onClose }: { onClose: () => void }) {
      const { dialogRef } = useDialogModal({ onClose });
      return createElement(
        "dialog",
        { ref: dialogRef, "data-testid": "dialog" },
        createElement("button", { "data-testid": "first" }, "first"),
        createElement("button", { "data-testid": "last" }, "last"),
      );
    }
    const { getByTestId } = render(createElement(FocusTrapDialog, { onClose: vi.fn() }));
    const first = getByTestId("first");
    first.focus();

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    expect(document.activeElement).toBe(getByTestId("last"));
  });

  it("shouldClose が false を返すときはbackdropクリックでも閉じない", () => {
    const onClose = vi.fn();
    function ShouldNotClose() {
      const { dialogRef, handleBackdropClick } = useDialogModal({ onClose });
      return createElement("dialog", {
        ref: dialogRef,
        "data-testid": "dialog",
        onClick: (e: React.MouseEvent<HTMLDialogElement>) => handleBackdropClick(e, () => false),
      });
    }
    const { getByTestId } = render(createElement(ShouldNotClose));
    fireEvent.click(getByTestId("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("メニューを開いたまま押したbackdropは閉じず、メニューが無ければ閉じる", () => {
    const onClose = vi.fn();
    function WithMenu({ menu }: { menu: boolean }) {
      const { dialogRef, handleBackdropClick } = useDialogModal({ onClose });
      return createElement(
        "dialog",
        {
          ref: dialogRef,
          "data-testid": "dialog",
          onClick: (e: React.MouseEvent<HTMLDialogElement>) => handleBackdropClick(e),
        },
        menu ? createElement("div", { "data-scope": "menu", "data-part": "content" }) : null,
      );
    }
    const press = (dialog: HTMLElement) => {
      fireEvent.pointerDown(dialog);
      fireEvent.click(dialog);
    };

    const withMenu = render(createElement(WithMenu, { menu: true }));
    press(withMenu.getByTestId("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    withMenu.unmount();

    const withoutMenu = render(createElement(WithMenu, { menu: false }));
    press(withoutMenu.getByTestId("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("メニューの項目から開いたダイアログは、閉じたときそのメニューのトリガーへフォーカスを戻す", () => {
    const trigger = document.createElement("button");
    trigger.id = "menu-trigger";
    const content = document.createElement("div");
    content.setAttribute("data-scope", "menu");
    content.setAttribute("data-part", "content");
    content.setAttribute("aria-labelledby", "menu-trigger");
    content.tabIndex = 0;
    document.body.append(trigger, content);
    content.focus();

    const { unmount } = render(createElement(TestDialog, { onClose: vi.fn() }));
    content.remove();
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
