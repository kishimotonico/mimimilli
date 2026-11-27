import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu } from "@ark-ui/react/menu";
import { describe, expect, it, vi } from "vitest";
import IconButton from "../../src/shared/ui/IconButton";
import { I } from "../../src/shared/ui/Icon";
import { MenuLayerItem } from "../../src/shared/ui/menu/MenuLayerItem";
import {
  MenuPopup,
  MotionMenuRoot,
  MotionMenuTrigger,
  useMotionMenu,
} from "../../src/shared/ui/menu/MotionMenu";

function TestMenu({ onSelect, disabled = false }: { onSelect: () => void; disabled?: boolean }) {
  const menu = useMotionMenu({ disabled });
  return (
    <MotionMenuRoot handle={menu}>
      <MotionMenuTrigger>
        <IconButton icon={I.more} label="メニュー" />
      </MotionMenuTrigger>
      <MenuPopup>
        <Menu.Item value="open" valueText="開く" onSelect={onSelect}>
          開く
        </Menu.Item>
        <Menu.Separator />
        <Menu.Item value="danger" valueText="除外">
          除外
        </Menu.Item>
      </MenuPopup>
    </MotionMenuRoot>
  );
}

function renderMenu(props: { disabled?: boolean } = {}) {
  const onSelect = vi.fn();
  render(<TestMenu onSelect={onSelect} {...props} />);
  return { onSelect, trigger: screen.getByRole("button", { name: "メニュー" }) };
}

describe("メニュー部品", () => {
  it("退出中はメニューが inert になり、項目を実行できない", async () => {
    const { onSelect, trigger } = renderMenu();
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    const menu = screen.getByRole("menu");
    expect(menu).toHaveAttribute("inert");
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

  it("無効なトリガーは、ポインターでもキーボードでも開かず、フォーカスを残す", async () => {
    const { trigger } = renderMenu({ disabled: true });
    trigger.focus();
    await userEvent.click(trigger);
    await userEvent.keyboard("{ArrowDown}{ArrowUp}{Enter}[Space]");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveAttribute("data-disabled");
  });

  it("無効なトリガーで、開くキーだけを止め、Tab と Esc は止めない", () => {
    const { trigger } = renderMenu({ disabled: true });
    trigger.focus();
    expect(fireEvent.keyDown(trigger, { key: "ArrowDown" })).toBe(false);
    expect(fireEvent.keyDown(trigger, { key: "Enter" })).toBe(false);
    expect(fireEvent.keyDown(trigger, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(trigger, { key: "Escape" })).toBe(true);
  });

  it("別の層を開く項目は、開いた層の初期フォーカスをトリガーへの復帰で奪わない", async () => {
    function Host() {
      const menu = useMotionMenu();
      return (
        <>
          <MotionMenuRoot handle={menu}>
            <MotionMenuTrigger>
              <button type="button">メニュー</button>
            </MotionMenuTrigger>
            <MenuPopup>
              <MenuLayerItem
                value="layer"
                onSelect={() => document.querySelector<HTMLElement>("#layer-input")?.focus()}
              >
                層を開く
              </MenuLayerItem>
            </MenuPopup>
          </MotionMenuRoot>
          <input id="layer-input" aria-label="層の入力" />
        </>
      );
    }
    render(<Host />);
    await userEvent.click(screen.getByRole("button", { name: "メニュー" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "層を開く" }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(screen.getByLabelText("層の入力")).toHaveFocus();
  });

  it("トリガーを含む領域がスクロールしたらメニューを閉じ、フォーカスはトリガーへ戻る", async () => {
    const { trigger } = renderMenu();
    await userEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.scroll(document);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(trigger).toHaveFocus();
  });
});
