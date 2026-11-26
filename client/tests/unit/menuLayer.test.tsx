import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RowMenu from "../../src/features/scan/ui/scanModal/unregistered/RowMenu";

function renderMenu(onSelect = vi.fn()) {
  render(<RowMenu label="メニュー" disabled={false} onOpenFolder={onSelect} onExclude={vi.fn()} />);
  return { onSelect, trigger: screen.getByRole("button", { name: "メニュー" }) };
}

describe("メニュー部品", () => {
  it("危険な項目は区切り線の下に置く", async () => {
    const { trigger } = renderMenu();
    await userEvent.click(trigger);
    const separator = screen.getByRole("separator");
    expect(separator.nextElementSibling).toHaveTextContent("除外");
  });

  it("退出中はメニューが inert になり、項目を実行できない", async () => {
    const { onSelect, trigger } = renderMenu();
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    const menu = screen.queryByRole("menu");
    if (menu) expect(menu).toHaveAttribute("inert");
    expect(onSelect).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("IME変換中の Esc・Enter では閉じも実行もしない", async () => {
    const { onSelect, trigger } = renderMenu();
    await userEvent.click(trigger);
    const menu = screen.getByRole("menu");
    await userEvent.keyboard("{ArrowDown}");

    fireEvent.keyDown(menu, { key: "Escape", isComposing: true });
    fireEvent.keyDown(menu, { key: "Escape", keyCode: 229 });
    fireEvent.keyDown(menu, { key: "Enter", isComposing: true });
    fireEvent.keyDown(menu, { key: "Enter", keyCode: 229 });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.keyDown(menu, { key: "Enter" });
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
  });

  it("開いている間にフォーカスが外へ移っても、メニューを閉じて移動先のフォーカスを保つ", async () => {
    const { trigger } = renderMenu();
    render(<input aria-label="外の入力" />);
    await userEvent.click(trigger);
    screen.getByLabelText("外の入力").focus();
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(screen.getByLabelText("外の入力")).toHaveFocus());
  });

  it("処理中（busy）はトリガーを押してもキーボードでも開かない", async () => {
    render(<RowMenu label="メニュー" busy onOpenFolder={vi.fn()} onExclude={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "メニュー" });
    await userEvent.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
