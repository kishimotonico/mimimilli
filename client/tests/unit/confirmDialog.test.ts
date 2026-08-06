// ConfirmDialog の開閉・確認・キャンセル（TASK-131: ネイティブdialogへの統合）のコンポーネントテスト。
// happy-dom は <dialog> の showModal/close を実装していないため、テスト対象に必要な分だけ差し替える。
import { createElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConfirmDialog from "../../src/shared/ui/ConfirmDialog";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

function renderConfirmDialog(
  overrides: Partial<{
    onConfirm: () => void;
    onCancel: () => void;
  }> = {},
) {
  const onConfirm = overrides.onConfirm ?? vi.fn();
  const onCancel = overrides.onCancel ?? vi.fn();
  render(
    createElement(ConfirmDialog, {
      title: "保護タグの削除",
      message: "「cv/水瀬なずな」は保護された分類のタグです。削除しますか？",
      confirmLabel: "削除する",
      onConfirm,
      onCancel,
    }),
  );
  return { onConfirm, onCancel };
}

function dispatchCancel(dialog: HTMLElement) {
  return fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: true }));
}

describe("ConfirmDialog", () => {
  it("マウント時に showModal を呼び、キャンセルボタンにフォーカスする", () => {
    renderConfirmDialog();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toHaveTextContent("キャンセル");
  });

  it("確認ボタンで onConfirm を呼ぶ", () => {
    const { onConfirm, onCancel } = renderConfirmDialog();
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("キャンセルボタンで onCancel を呼ぶ", () => {
    const { onConfirm, onCancel } = renderConfirmDialog();
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Escapeで onCancel を呼ぶ", () => {
    const { onConfirm, onCancel } = renderConfirmDialog();
    const dialog = screen.getByRole("alertdialog", { name: "保護タグの削除" });
    dispatchCancel(dialog);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("backdropクリックで onCancel を呼ぶ", () => {
    const { onConfirm, onCancel } = renderConfirmDialog();
    const dialog = screen.getByRole("alertdialog", { name: "保護タグの削除" });
    fireEvent.click(dialog);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("パネル内側のクリックでは閉じない", () => {
    const { onCancel } = renderConfirmDialog();
    fireEvent.click(
      screen.getByText("「cv/水瀬なずな」は保護された分類のタグです。削除しますか？"),
    );
    expect(onCancel).not.toHaveBeenCalled();
  });
});
