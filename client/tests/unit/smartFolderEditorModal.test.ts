// SmartFolderEditorModal のEsc/backdrop挙動（TASK-29: ネイティブdialogへの統合）のコンポーネントテスト。
// happy-dom は <dialog> の showModal/close を実装していないため、テスト対象に必要な分だけ差し替える。
import type { ComponentProps } from "react";
import type { SmartFolder } from "@mimimilli/shared";
import { createElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SmartFolderEditorModal from "../../src/features/library/ui/SmartFolderEditorModal";
import * as smartFolderApi from "../../src/entities/smart-folder/api";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
  // ライブ件数プレビュー（TASK-428.11）はモーダル内でAPIを呼ぶため、テストでは常に固定値で応答する
  vi.spyOn(smartFolderApi, "previewSmartFolderRuleCount").mockResolvedValue(0);
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(SmartFolderEditorModal, {
        folder: null,
        tagSuggestions: [],
        tagPrefixes: [],
        isSaving,
        saveError: null,
        onClose,
        onSave,
        ...props,
      }),
    ),
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

  it("名前が空で送信するとエラー件数alertを出し、名前欄へフォーカス・スクロールする", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const { onSave } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(screen.getByRole("alert")).toHaveTextContent("入力に不備があります（2件）");
    expect(scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByPlaceholderText("例: 長時間 ASMR"));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("条件エラー時は条件カードにaria-invalidを付け、その入力へフォーカスする", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const folder = {
      id: "sf-1",
      name: "テスト",
      rules: [{ conjunction: "WHERE", field: "タグ", operator: "∋", values: ["cv/"] }],
      sort: "added-desc",
      createdAt: "2026-07-10T00:00:00.000Z",
    } satisfies SmartFolder;
    renderModal({ props: { folder } });

    fireEvent.click(screen.getByRole("button", { name: "変更を保存" }));

    const card = screen.getByText("「cv/」は登録できないタグです").closest("[data-rule-id]");
    expect(card).toHaveAttribute("aria-invalid", "true");
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("妥当な条件のときライブ件数プレビューを表示する", async () => {
    vi.spyOn(smartFolderApi, "previewSmartFolderRuleCount").mockResolvedValue(7);
    const folder = {
      id: "sf-1",
      name: "テスト",
      rules: [{ conjunction: "WHERE", field: "タグ", operator: "∋", values: ["ASMR"] }],
      sort: "added-desc",
      createdAt: "2026-07-10T00:00:00.000Z",
    } satisfies SmartFolder;
    renderModal({ props: { folder } });

    await screen.findByText((_, el) => el?.textContent === "条件一致 7件");
  });

  it("条件が妥当でない間はライブ件数プレビューを問い合わせない", () => {
    const preview = vi.spyOn(smartFolderApi, "previewSmartFolderRuleCount");
    preview.mockClear();
    renderModal(); // 新規作成の初期ドラフトはタグ未選択で不正

    expect(preview).not.toHaveBeenCalled();
  });
});

describe("SmartFolderEditorModal の未確定タグ入力（TASK-428.24 SF-08）", () => {
  it("候補に一致する未確定入力は保存時にEnterと同じ値で確定される", () => {
    const { onSave } = renderModal({ props: { tagSuggestions: ["ASMR"] } });

    fireEvent.change(screen.getByPlaceholderText("例: 長時間 ASMR"), {
      target: { value: "テスト" },
    });
    fireEvent.change(screen.getByLabelText("1件目の条件に追加するタグ"), {
      target: { value: "ASMR" },
    });

    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        rules: [expect.objectContaining({ field: "タグ", values: ["ASMR"] })],
      }),
    );
  });

  it("候補に一致しない未確定入力は破棄されず、入力欄へ戻ってエラーを示す", () => {
    const { onSave } = renderModal({ props: { tagSuggestions: ["ASMR"] } });

    fireEvent.change(screen.getByPlaceholderText("例: 長時間 ASMR"), {
      target: { value: "テスト" },
    });
    const tagInput = screen.getByLabelText("1件目の条件に追加するタグ");
    fireEvent.change(tagInput, { target: { value: "a/" } });

    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(screen.getByText("入力中のタグを確定してください")).toBeInTheDocument();
    expect(document.activeElement).toBe(tagInput);
    expect(tagInput).toHaveValue("a/");
    expect(onSave).not.toHaveBeenCalled();
  });
});
