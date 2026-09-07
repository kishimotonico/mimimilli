// SettingsModal のEsc/backdrop挙動（TASK-29: ネイティブdialogへの統合）のコンポーネントテスト。
// happy-dom は <dialog> の showModal/close を実装していないため、テスト対象に必要な分だけ差し替える。
// TagPrefixSettings が react-query を使うため QueryClientProvider で包む。
import { createElement } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsModal from "../../src/features/settings/ui/SettingsModal";
import { dlsiteBulkActionsAtom } from "../../src/entities/dlsite/model/bulkAtoms";
import { ApiRequestError } from "../../src/shared/api/http";

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

interface RenderModalOptions {
  onClose?: ReturnType<typeof vi.fn>;
  onOpenScan?: ReturnType<typeof vi.fn>;
  onChangeFolder?: ReturnType<typeof vi.fn>;
  lastScanTime?: string | null;
  /** 直近の完了スキャンが対象にしたルートフォルダー。既定は rootFolder と同一（notice非表示） */
  lastScanRootFolder?: string | null;
}

function renderModal(options: RenderModalOptions = {}) {
  const onClose = options.onClose ?? vi.fn();
  const onOpenScan = options.onOpenScan ?? vi.fn();
  const onChangeFolder = options.onChangeFolder ?? vi.fn();
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
  const tree = (opts: RenderModalOptions) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store },
        createElement(SettingsModal, {
          rootFolder: "/audio",
          lastScanTime: opts.lastScanTime ?? null,
          lastScanRootFolder: opts.lastScanRootFolder ?? "/audio",
          onClose,
          onOpenScan,
          onChangeFolder,
          onExport: vi.fn(),
        }),
      ),
    );
  const { rerender: rtlRerender, unmount } = render(tree(options));
  const rerender = (nextOptions: RenderModalOptions) => rtlRerender(tree(nextOptions));
  return { onClose, onOpenScan, onChangeFolder, rerender, unmount };
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

  it("保存中はボタンに保存中と表示し、二重送信できない", async () => {
    let resolveChange!: () => void;
    const onChangeFolder = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveChange = resolve;
        }),
    );
    renderModal({ onChangeFolder });
    fireEvent.click(screen.getByRole("button", { name: "変更" }));
    fireEvent.change(screen.getByLabelText("ルートフォルダーのパス"), {
      target: { value: "/new/root" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    const savingButton = await screen.findByRole("button", { name: "保存中..." });
    expect(savingButton).toBeDisabled();
    fireEvent.click(savingButton);
    expect(onChangeFolder).toHaveBeenCalledTimes(1);

    resolveChange();
    await waitFor(() => {
      expect(screen.queryByLabelText("ルートフォルダーのパス")).toBeNull();
    });
  });

  it("保存中はフッターの閉じるボタンもモーダルを閉じない（アンマウント後のstate更新を防ぐ）", async () => {
    let resolveChange!: () => void;
    const onChangeFolder = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveChange = resolve;
        }),
    );
    const { onClose } = renderModal({ onChangeFolder });
    fireEvent.click(screen.getByRole("button", { name: "変更" }));
    fireEvent.change(screen.getByLabelText("ルートフォルダーのパス"), {
      target: { value: "/new/root" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByRole("button", { name: "保存中..." });

    const footerCloseButton = screen
      .getAllByRole("button", { name: "閉じる" })
      .find((button) => button.tagName === "BUTTON" && button.textContent === "閉じる")!;
    fireEvent.click(footerCloseButton);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("ルートフォルダーのパス")).toBeInTheDocument();

    resolveChange();
    await waitFor(() => {
      expect(screen.queryByLabelText("ルートフォルダーのパス")).toBeNull();
    });
  });

  it("保存失敗時はエラーメッセージを表示し、編集フォームを開いたままにする", async () => {
    const onChangeFolder = vi.fn(() =>
      Promise.reject(
        new ApiRequestError(400, "invalid_request", "指定したフォルダーが見つかりません"),
      ),
    );
    renderModal({ onChangeFolder });
    fireEvent.click(screen.getByRole("button", { name: "変更" }));
    fireEvent.change(screen.getByLabelText("ルートフォルダーのパス"), {
      target: { value: "/no/such/folder" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "指定したフォルダーが見つかりません",
    );
    expect(screen.getByLabelText("ルートフォルダーのパス")).toBeInTheDocument();
  });

  const STALE_NOTICE_TEXT =
    "一覧は変更前のフォルダーの内容です。再スキャンすると新しいフォルダーの内容に更新されます。";

  it("直近スキャンのルートが現在のrootFolderと不一致ならinline noticeを表示する", () => {
    renderModal({ lastScanRootFolder: "/old-root" });
    expect(screen.getByText(STALE_NOTICE_TEXT)).toBeInTheDocument();
  });

  it("直近スキャンのルートが現在のrootFolderと一致すればinline noticeを表示しない", () => {
    renderModal({ lastScanRootFolder: "/audio" });
    expect(screen.queryByText(STALE_NOTICE_TEXT)).toBeNull();
  });

  it("サーバーから返る値だけで判定するため、リロード相当（別クエリクライアントでの再取得）でも案内が出続ける", () => {
    // クライアントのメモリ状態（jotai store・queryClient）を作り直しても、
    // settings応答のlastScanRootFolderがrootFolderと不一致な限りnoticeは出続ける。
    const { unmount } = renderModal({ lastScanRootFolder: "/old-root" });
    expect(screen.getByText(STALE_NOTICE_TEXT)).toBeInTheDocument();
    unmount();

    renderModal({ lastScanRootFolder: "/old-root" });
    expect(screen.getByText(STALE_NOTICE_TEXT)).toBeInTheDocument();
  });

  it("サーバー再起動相当（プロセスをまたぐgetSettings由来のprops）でも案内が出続ける", () => {
    // rootFolderChangedAtのようなクライアントメモリの起点を持たないため、
    // サーバープロセスが再起動してsettingsの応答だけが渡された場合でも同じ結果になる。
    renderModal({ lastScanRootFolder: "/old-root", lastScanTime: "2026-09-01T00:00:00.000Z" });
    expect(screen.getByText(STALE_NOTICE_TEXT)).toBeInTheDocument();
  });

  it("再スキャン完了後（lastScanRootFolderがrootFolderに追いつく）はinline noticeが消える", () => {
    const { rerender } = renderModal({ lastScanRootFolder: "/old-root" });
    expect(screen.getByText(STALE_NOTICE_TEXT)).toBeInTheDocument();

    rerender({ lastScanRootFolder: "/audio" });
    expect(screen.queryByText(STALE_NOTICE_TEXT)).toBeNull();
  });
});
