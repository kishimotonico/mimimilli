// SettingsModal のEsc/backdrop挙動（TASK-29: ネイティブdialogへの統合）のコンポーネントテスト。
// jsdom は <dialog> の showModal/close を実装していないため、テスト対象に必要な分だけ差し替える。
// TagPrefixSettings が react-query を使うため QueryClientProvider で包む。
// DLsite一括取得の状態はTASK-41でApp側へ持ち上げたため、SettingsModalへはpropsで渡す。
import { createElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsModal from "../../src/features/settings/ui/SettingsModal";

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

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(SettingsModal, {
        rootFolder: "/audio",
        lastScanTime: null,
        scanning: false,
        dlsiteBulk: { active: false, progress: null, onStart: vi.fn() },
        onClose,
        onScan: vi.fn(),
        onChangeFolder: vi.fn(),
        onExport: vi.fn(),
      }),
    ),
  );
  return { onClose };
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

  it("backdropクリックは編集中でも問答無用でモーダルを閉じる（既存挙動を維持）", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "変更" }));
    expect(screen.getByLabelText("ルートフォルダーのパス")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "設定" });
    fireEvent.click(dialog);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("パネル内側のクリックでは閉じない", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText("ルートフォルダー"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
