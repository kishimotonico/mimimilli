// SmartFolderEditorModal のEsc/backdrop挙動（TASK-29: ネイティブdialogへの統合）のコンポーネントテスト。
// jsdom は <dialog> の showModal/close を実装していないため、テスト対象に必要な分だけ差し替える。
import { createElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SmartFolderEditorModal from "../../src/features/library/ui/SmartFolderEditorModal";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

function renderModal(isSaving = false, onClose = vi.fn()) {
  render(
    createElement(SmartFolderEditorModal, {
      folder: null,
      tagSuggestions: [],
      isSaving,
      saveError: null,
      onClose,
      onSave: vi.fn(),
    }),
  );
  return { onClose };
}

function dispatchCancel(dialog: HTMLElement) {
  return fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: true }));
}

describe("SmartFolderEditorModal", () => {
  it("Escapeでモーダルを閉じる", () => {
    const { onClose } = renderModal();
    const dialog = screen.getByRole("dialog", { hidden: true });
    dispatchCancel(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("保存中はEscapeでも閉じない", () => {
    const { onClose } = renderModal(true);
    const dialog = screen.getByRole("dialog", { hidden: true });
    dispatchCancel(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("backdropクリックでモーダルを閉じる", () => {
    const { onClose } = renderModal();
    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("保存中はbackdropクリックでも閉じない（既存挙動を維持）", () => {
    const { onClose } = renderModal(true);
    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("フォーム内側のクリックでは閉じない", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText("条件を追加"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
