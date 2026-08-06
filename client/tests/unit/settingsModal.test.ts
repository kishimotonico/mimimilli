// SettingsModal のEsc/backdrop挙動（TASK-29: ネイティブdialogへの統合）のコンポーネントテスト。
// happy-dom は <dialog> の showModal/close を実装していないため、テスト対象に必要な分だけ差し替える。
// TagPrefixSettings が react-query を使うため QueryClientProvider で包む。
import { createElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsModal from "../../src/features/settings/ui/SettingsModal";
import { dlsiteBulkActionsAtom } from "../../src/features/dlsite/model/atoms";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
  vi.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => [],
  } as Response);
});

function renderModal(onClose = vi.fn(), onOpenScan = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const store = createStore();
  store.set(dlsiteBulkActionsAtom, {
    start: vi.fn(),
    attach: vi.fn(),
    cancel: vi.fn(),
    dismiss: vi.fn(),
  });
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store },
        createElement(SettingsModal, {
          rootFolder: "/audio",
          lastScanTime: null,
          onClose,
          onOpenScan,
          onChangeFolder: vi.fn(),
          onExport: vi.fn(),
        }),
      ),
    ),
  );
  return { onClose, onOpenScan };
}

function dispatchCancel(dialog: HTMLElement) {
  return fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: true }));
}

describe("SettingsModal", () => {
  it("ルートフォルダー編集中のEscapeは編集フォームだけを閉じ、モーダルは閉じない", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "変更" }));
    expect(screen.getByLabelText("ルートフォルダーのパス")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "設定" });
    dispatchCancel(dialog);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("ルートフォルダーのパス")).toBeNull();
  });

  it("編集中でないときのEscapeは設定モーダルを閉じる", () => {
    const { onClose } = renderModal();
    const dialog = screen.getByRole("dialog", { name: "設定" });
    dispatchCancel(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdropクリックは編集中は編集フォームだけを閉じ、モーダルは閉じない", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "変更" }));
    expect(screen.getByLabelText("ルートフォルダーのパス")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "設定" });
    fireEvent.click(dialog);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("ルートフォルダーのパス")).toBeNull();
  });

  it("ルートフォルダー編集中の×ボタンは編集フォームだけを閉じ、モーダルは閉じない", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "変更" }));
    expect(screen.getByLabelText("ルートフォルダーのパス")).toBeInTheDocument();

    const closeButtons = screen.getAllByRole("button", { name: "閉じる" });
    fireEvent.click(closeButtons[0]!);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("ルートフォルダーのパス")).toBeNull();
  });

  it("パネル内側のクリックでは閉じない", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText("ルートフォルダー"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("スキャンボタンは即時実行せずonOpenScanを呼ぶ（TASK-56: スキャンモーダルへ経路を統一）", () => {
    const { onOpenScan } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "スキャン" }));
    expect(onOpenScan).toHaveBeenCalledTimes(1);
  });

  it("閲覧モードのルートフォルダーパスは選択可能クラスを持つ", () => {
    renderModal();
    expect(screen.getByText("/audio")).toHaveClass("mll-selectable");
  });

  it("ヘッダーの閉じるボタンに accessible name がある", () => {
    renderModal();
    expect(screen.getAllByRole("button", { name: "閉じる" }).length).toBeGreaterThanOrEqual(1);
  });
});
