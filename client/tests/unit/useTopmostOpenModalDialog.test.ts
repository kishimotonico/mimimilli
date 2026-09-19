// useTopmostOpenModalDialogの単体テスト。useDialogModalがshowModal()/close()の度に
// openModalDialogsAtomへpush/popするスタックをこのフックが読むだけになったため、
// useDialogModalと組み合わせて開閉順を検証する。
import { createElement, useState } from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDialogModal } from "../../src/shared/ui/useDialogModal";
import { useTopmostOpenModalDialog } from "../../src/shared/ui/useTopmostOpenModalDialog";

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

function ModalDialog({ testId, onClose }: { testId: string; onClose: () => void }) {
  const { dialogRef } = useDialogModal({ onClose });
  return createElement("dialog", { ref: dialogRef, "data-testid": testId });
}

function Probe() {
  const dialog = useTopmostOpenModalDialog();
  return createElement("div", { "data-testid": "topmost" }, dialog?.dataset.testid ?? "none");
}

function App() {
  const [showFirst, setShowFirst] = useState(true);
  const [showSecond, setShowSecond] = useState(false);
  return createElement(
    "div",
    null,
    createElement(Probe),
    showFirst &&
      createElement(ModalDialog, { testId: "first", onClose: () => setShowFirst(false) }),
    showSecond &&
      createElement(ModalDialog, { testId: "second", onClose: () => setShowSecond(false) }),
    createElement(
      "button",
      { "data-testid": "open-second", onClick: () => setShowSecond(true) },
      "open second",
    ),
  );
}

describe("useTopmostOpenModalDialog", () => {
  it("何も開いていなければnullを返す", () => {
    function Bare() {
      return createElement(Probe);
    }
    const { getByTestId } = render(createElement(Bare));
    expect(getByTestId("topmost").textContent).toBe("none");
  });

  it("開いた順で末尾（最後に開いたもの）を最前面として返す", () => {
    const { getByTestId } = render(createElement(App));
    expect(getByTestId("topmost").textContent).toBe("first");

    fireEvent.click(getByTestId("open-second"));
    expect(getByTestId("topmost").textContent).toBe("second");
  });

  it("最前面のdialogが閉じれば、その下のdialogへ戻る", () => {
    function CloseableApp() {
      const [open, setOpen] = useState(true);
      return createElement(
        "div",
        null,
        createElement(Probe),
        createElement(ModalDialog, { testId: "first", onClose: () => {} }),
        open && createElement(ModalDialog, { testId: "second", onClose: () => setOpen(false) }),
        createElement("button", { "data-testid": "close-second", onClick: () => setOpen(false) }),
      );
    }
    const { getByTestId } = render(createElement(CloseableApp));
    expect(getByTestId("topmost").textContent).toBe("second");

    fireEvent.click(getByTestId("close-second"));
    expect(getByTestId("topmost").textContent).toBe("first");
  });
});
