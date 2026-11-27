import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu } from "@ark-ui/react/menu";
import { describe, expect, it, vi } from "vitest";
import SplitButton from "../../src/shared/ui/SplitButton";

const menu = (
  <Menu.Item value="a" valueText="項目">
    項目
  </Menu.Item>
);

describe("SplitButton", () => {
  it("主ボタンだけ無効にすると、主ボタンは押しても何も起きず、▾のメニューは開く", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <SplitButton onClick={onClick} menu={menu} primaryDisabled>
        追加
      </SplitButton>,
    );
    const primary = screen.getByRole("button", { name: "追加" });
    expect(primary).toHaveAttribute("aria-disabled", "true");
    await user.click(primary);
    primary.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("[Space]");
    expect(onClick).not.toHaveBeenCalled();
    expect(primary).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "その他の操作" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("全体を無効にすると、主ボタンも▾も何も起きない", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <SplitButton onClick={onClick} menu={menu} disabled>
        追加
      </SplitButton>,
    );
    await user.click(screen.getByRole("button", { name: "追加" }));
    const caret = screen.getByRole("button", { name: "その他の操作" });
    await user.click(caret);
    caret.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(caret).toHaveFocus();
  });

  it("開く操作を横取りすると、ポインターでもキーでも開かない", async () => {
    const user = userEvent.setup();
    let intercept = true;
    const interceptMenuOpen = vi.fn(() => intercept);
    render(
      <SplitButton onClick={() => {}} menu={menu} interceptMenuOpen={interceptMenuOpen}>
        追加
      </SplitButton>,
    );
    const caret = screen.getByRole("button", { name: "その他の操作" });
    await user.click(caret);
    caret.focus();
    for (const key of ["{Enter}", "[Space]", "{ArrowDown}", "{ArrowUp}"]) await user.keyboard(key);
    expect(interceptMenuOpen).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(caret).toHaveFocus();
    intercept = false;
    await user.click(caret);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("▾を開いたまま外のフォーカスできる要素を押すと、フォーカスはその要素に残る", async () => {
    const user = userEvent.setup();
    render(
      <>
        <SplitButton onClick={() => {}} menu={menu}>
          追加
        </SplitButton>
        <input aria-label="外の入力" />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "その他の操作" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(screen.getByRole("textbox", { name: "外の入力" }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(screen.getByRole("textbox", { name: "外の入力" })).toHaveFocus();
  });
});
