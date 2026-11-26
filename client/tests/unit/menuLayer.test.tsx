import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { isInsideOwnMenuTree } from "../../src/shared/ui/menu/MotionMenu";
import { Menu } from "@ark-ui/react/menu";
import { MenuLayerItem } from "../../src/shared/ui/menu/MenuLayerItem";
import { MenuPopup, MotionMenuRoot, useMotionMenu } from "../../src/shared/ui/menu/MotionMenu";
import { menuPanelClass } from "../../src/shared/ui/menu/menuStyles";
import RowMenu from "../../src/features/scan/ui/scanModal/unregistered/RowMenu";

function renderMenu(onSelect = vi.fn()) {
  render(<RowMenu label="メニュー" busy={false} onOpenFolder={onSelect} onExclude={vi.fn()} />);
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

  it("自分のツリー（自分の中身から開いたサブメニュー、自分の右クリックのトリガー）だけを内側とする", () => {
    document.body.innerHTML = `
      <div id="mine" data-scope="menu" data-part="content"><div id="sub-trigger"></div></div>
      <div data-scope="menu" data-part="content" aria-labelledby="sub-trigger"><button id="in-sub"></button></div>
      <div data-scope="menu" data-part="content" aria-labelledby="grand-trigger"><button id="in-grand"></button></div>
      <div data-scope="menu" data-part="content" aria-labelledby="sub-trigger"><div id="grand-trigger"></div></div>
      <div id="other-trigger"></div>
      <div data-scope="menu" data-part="content" aria-labelledby="other-trigger"><button id="in-other"></button></div>
      <div id="ctx" data-scope="menu" data-part="context-trigger"><span id="in-ctx"></span></div>
      <div id="other-ctx" data-scope="menu" data-part="context-trigger"><span id="in-other-ctx"></span></div>
      <button id="outside"></button>`;
    const inside = (id: string) => isInsideOwnMenuTree(document.getElementById(id), "mine", "ctx");
    expect(inside("in-sub")).toBe(true);
    expect(inside("in-grand")).toBe(true);
    expect(inside("in-ctx")).toBe(true);
    expect(inside("in-other")).toBe(false);
    expect(inside("in-other-ctx")).toBe(false);
    expect(inside("outside")).toBe(false);
    expect(isInsideOwnMenuTree(null, "mine", "ctx")).toBe(false);
    document.body.innerHTML = "";
  });

  it("処理中のトリガーで、開くキーだけを止め、Tab と Esc は止めない", async () => {
    render(<RowMenu label="メニュー" busy onOpenFolder={vi.fn()} onExclude={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "メニュー" });
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
            <Menu.Trigger asChild>
              <button type="button">メニュー</button>
            </Menu.Trigger>
            <MenuPopup origin="top left">
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

  it("パネルは長いラベルを省略できるよう、列の幅を内容に押し広げさせない", () => {
    expect(menuPanelClass()).toContain("grid-cols-[minmax(0,1fr)]");
  });
});
