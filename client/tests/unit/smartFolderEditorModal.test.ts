// SmartFolderEditorModal のEsc/backdrop挙動（TASK-29: ネイティブdialogへの統合）のコンポーネントテスト。
// happy-dom は <dialog> の showModal/close を実装していないため、テスト対象に必要な分だけ差し替える。
import type { ComponentProps } from "react";
import type { SmartFolder } from "@mimimilli/shared";
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

function renderModal({
  props = {},
  isSaving = false,
  onClose = vi.fn(),
}: {
  props?: Partial<ComponentProps<typeof SmartFolderEditorModal>>;
  isSaving?: boolean;
  onClose?: ReturnType<typeof vi.fn>;
} = {}) {
  const onSave = props.onSave ?? vi.fn();
  render(
    createElement(SmartFolderEditorModal, {
      folder: null,
      tagSuggestions: [],
      isSaving,
      saveError: null,
      onClose,
      onSave,
      ...props,
    }),
  );
  return { onClose, onSave };
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
    const { onClose } = renderModal({ isSaving: true });
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
    const { onClose } = renderModal({ isSaving: true });
    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("フォーム内側のクリックでは閉じない", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText("条件を追加"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("無効なタグを含む条件で送信しても例外にならずインラインエラーを表示する", () => {
    const folder = {
      id: "sf-1",
      name: "テスト",
      rules: [{ conjunction: "WHERE", field: "タグ", operator: "∋", values: ["cv/"] }],
      sort: "added-desc",
      createdAt: "2026-07-10T00:00:00.000Z",
    } satisfies SmartFolder;
    const { onSave } = renderModal({ props: { folder } });

    fireEvent.click(screen.getByRole("button", { name: "変更を保存" }));

    expect(screen.getByText("「cv/」は登録できないタグです")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
