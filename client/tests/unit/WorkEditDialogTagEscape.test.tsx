// WorkEditDialog + WorkTagEditor + TagComboboxを実コンポーネントのまま組み合わせ、
// 428.13のEscape階層契約（候補優先で1段だけ閉じる）とdirty時の未保存確認プロンプトが
// 競合しないことを確認する（WorkEditDialog.test.tsxはWorkTagEditorをモックしているため
// この組み合わせだけはそちらではカバーできない）。
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { WorkEditDialog } from "../../src/features/library/ui/preview/WorkEditDialog";
import { mockApi } from "../helpers/api";
import { buildSettings, buildWork, buildWorkEditSnapshotOf } from "../helpers/builders";

vi.mock("../../src/features/library/ui/preview/DlsiteEditor", () => ({
  DlsiteEditor: () => null,
}));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

function renderDialog(onClose: () => void) {
  const work = buildWork({ id: "w1", physicalPath: "/lib/w1" });
  const snapshot = buildWorkEditSnapshotOf(work, "revision-1");
  mockApi({
    "GET /api/works/:id/source": snapshot,
    "GET /api/settings": buildSettings(),
    "GET /api/tag-prefixes": [],
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(WORK_QUERY_KEYS.source(work.id), snapshot);
  const noop = {
    isPending: false,
    error: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkEditDialog
        work={work}
        tagSuggestions={["ASMR", "睡眠用"]}
        workPatchMutations={{
          editMutation: noop as never,
        }}
        onClose={onClose}
      />
    </QueryClientProvider>,
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
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(tagInput, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull(); // 候補だけが閉じる
    expect(screen.getByRole("combobox", { name: "追加するタグ" })).toBeInTheDocument(); // タグ追加欄自体は開いたまま
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
    expect(screen.getByRole("alertdialog", { name: "未保存の変更があります" })).toBeInTheDocument();
  });
});
