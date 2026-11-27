import { render, screen } from "@testing-library/react";
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

  it("メニューの開閉を呼び出し側が持つと、開く要求を受け入れるまで開かない", async () => {
    const user = userEvent.setup();
    const onMenuOpenChange = vi.fn();
    render(
      <SplitButton
        onClick={() => {}}
        menu={menu}
        menuOpen={false}
        onMenuOpenChange={onMenuOpenChange}
      >
        追加
      </SplitButton>,
    );
    await user.click(screen.getByRole("button", { name: "その他の操作" }));
    expect(onMenuOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
