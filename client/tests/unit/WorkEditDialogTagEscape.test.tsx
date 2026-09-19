// WorkEditDialog + WorkTagEditor + TagComboboxを実コンポーネントのまま組み合わせ、
// 428.13のEscape階層契約（候補優先で1段だけ閉じる）とdirty時の未保存確認プロンプトが
// 競合しないことを確認する（WorkEditDialog.test.tsxはWorkTagEditorをモックしているため
// この組み合わせだけはそちらではカバーできない）。
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Work } from "@mimimilli/shared";
import { emptyDlsiteState } from "@mimimilli/shared";
import { WorkEditDialog } from "../../src/features/library/ui/preview/WorkEditDialog";

vi.mock("../../src/features/library/ui/preview/DlsiteEditor", () => ({
  DlsiteEditor: () => null,
}));
vi.mock("../../src/entities/tag/useTagPrefixes", () => ({
  useTagPrefixes: () => ({ tagPrefixes: [] }),
}));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

function makeWork(overrides: Partial<Work> = {}): Work {
  return {
    id: "w1",
    title: "作品",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/lib/w1",
    totalDurationSec: 120,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    defaultPlaylistId: null,
    createdAt: null,
    playlists: [],
    resume: null,
    sourceRevision: "revision-1",
    ...overrides,
  };
}

function renderDialog(onClose: () => void) {
  return render(
    <WorkEditDialog
      work={makeWork()}
      tagSuggestions={["ASMR", "睡眠用"]}
      workPatchMutations={{
        titleMutation: { isPending: false, error: null, reset: vi.fn(), mutate: vi.fn() } as never,
        tagsMutation: {
          isPending: false,
          error: null,
          reset: vi.fn(),
          mutateAsync: vi.fn(),
        } as never,
        urlsMutation: { mutate: vi.fn(), isPending: false, error: null } as never,
      }}
      onClose={onClose}
    />,
  );
}

describe("WorkEditDialog × WorkTagEditor: Escapeの契約統合", () => {
  it("タグ候補が開いている状態でEscapeを押すと候補だけが閉じ、未保存確認プロンプトは出ない", () => {
    const onClose = vi.fn();
    const { container } = renderDialog(onClose);

    // dirtyにする（未保存確認プロンプトが出せる状態を作る）
    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });

    fireEvent.click(screen.getByRole("button", { name: "タグを追加" }));
    const tagInput = screen.getByRole("combobox", { name: "追加するタグ" });
    fireEvent.change(tagInput, { target: { value: "睡" } });
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.keyDown(tagInput, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull(); // 候補だけが閉じる
    expect(screen.getByRole("combobox", { name: "追加するタグ" })).toBeTruthy(); // タグ追加欄自体は開いたまま
    expect(screen.queryByRole("alertdialog", { name: "未保存の変更があります" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    const dialog = container.querySelector("dialog");
    expect(dialog?.open).toBe(true);
  });

  it("フォーカスがタグ入力の外にある状態でEscapeを押すとdirtyなら未保存確認プロンプトが出る", () => {
    const onClose = vi.fn();
    const { container } = renderDialog(onClose);

    fireEvent.change(screen.getByLabelText("タイトル"), { target: { value: "編集途中" } });

    // タグ追加欄は開かない（フォーカスはタイトル欄側のまま）＝428.13の除外セレクタ・
    // TagComboboxのEscapeガードのどちらも関与しない経路
    const dialog = container.querySelector("dialog");
    if (!dialog) throw new Error("dialog not found");
    fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: true }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "未保存の変更があります" })).toBeTruthy();
  });
});
