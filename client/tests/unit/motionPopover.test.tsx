import { useRef, useState, type ReactNode } from "react";
import { Menu } from "@ark-ui/react/menu";
import { Popover } from "@ark-ui/react/popover";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { resolveFocusReturnTarget } from "../../src/shared/lib/focusReturnTarget";
import IconButton from "../../src/shared/ui/IconButton";
import { MenuPopup, MotionMenuRoot, useMotionMenu } from "../../src/shared/ui/menu/MotionMenu";
import {
  MotionPopoverRoot,
  PopoverPopup,
  useMotionPopover,
} from "../../src/shared/ui/popover/MotionPopover";
import { useDialogModal } from "../../src/shared/ui/useDialogModal";
import { useElementWidth } from "../../src/shared/ui/useElementWidth";
import { getResizeObservers } from "./setup";

function Panel({
  name,
  open,
  onChange,
  restoreFocus,
  children,
  onKeyDown,
  contentRef,
}: {
  name: string;
  open: boolean;
  onChange: (open: boolean) => void;
  restoreFocus?: boolean;
  children?: ReactNode;
  onKeyDown?: () => void;
  contentRef?: (element: HTMLDivElement | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const handle = useMotionPopover({
    open,
    onOpenChange: (details) => onChange(details.open),
    initialFocusEl: () => input.current,
    restoreFocus,
  });
  return (
    <MotionPopoverRoot handle={handle}>
      <Popover.Trigger>{name}を開く</Popover.Trigger>
      <PopoverPopup ref={contentRef} aria-label={name} onKeyDown={onKeyDown} className="w-60">
        <input ref={input} aria-label={`${name}の検索欄`} />
        <button type="button" onClick={handle.closeAndReturn}>確定</button>
        <button type="button" onClick={handle.focusInitial}>検索欄へ移動</button>
        {children}
      </PopoverPopup>
    </MotionPopoverRoot>
  );
}

function SinglePanel({ onChange, children, onKeyDown }: {
  onChange?: (open: boolean) => void;
  children?: ReactNode;
  onKeyDown?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Panel name="パネル" open={open} onChange={(next) => {
      onChange?.(next);
      setOpen(next);
    }} onKeyDown={onKeyDown}>
      {children}
    </Panel>
  );
}

const panelTrigger = () => screen.getByRole("button", { name: "パネルを開く" });
const panelInput = () => screen.getByRole("textbox", { name: "パネルの検索欄" });

function NestedMenu() {
  const handle = useMotionMenu();
  return (
    <MotionMenuRoot handle={handle}>
      <Menu.Trigger>メニューを開く</Menu.Trigger>
      <MenuPopup origin="top left">
        <Menu.Item value="item">メニュー項目</Menu.Item>
      </MenuPopup>
    </MotionMenuRoot>
  );
}

function DialogHost({ onClose }: { onClose: () => void }) {
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose });
  return (
    <dialog
      aria-label="親ダイアログ"
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event)}
    >
      <SinglePanel><NestedMenu /></SinglePanel>
      <button type="button">外の操作</button>
    </dialog>
  );
}

function renderDialog(onClose = vi.fn()) {
  // happy-dom は native dialog の開閉と Esc → cancel を再現しない。
  const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
  const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true; } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false; } },
  });
  const restore = () => {
    if (showModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModal);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    if (close) Object.defineProperty(HTMLDialogElement.prototype, "close", close);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  };
  const view = render(<DialogHost onClose={onClose} />);
  return { onClose, unmount() { try { view.unmount(); } finally { restore(); } } };
}

async function openNestedMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(panelTrigger());
  await waitFor(() => expect(panelInput()).toHaveFocus());
  await user.click(screen.getByRole("button", { name: "メニューを開く" }));
  const menu = screen.getByRole("menu");
  expect(screen.getByRole("dialog", { name: "パネル" })).toContainElement(menu);
  await waitFor(() => expect(menu).toHaveFocus());
}

describe("ポップオーバーのフォーカス", () => {
  it("外へ移して閉じたときは移動先からフォーカスを奪わない", async () => {
    const user = userEvent.setup();
    render(<><SinglePanel /><input aria-label="外の入力" /></>);
    await user.click(panelTrigger());
    await waitFor(() => expect(panelInput()).toHaveFocus());
    const outside = screen.getByRole("textbox", { name: "外の入力" });
    act(() => outside.focus());
    await waitFor(() => expect(panelTrigger()).toHaveAttribute("aria-expanded", "false"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "パネル" })).toBeNull());
    expect(outside).toHaveFocus();
  });

  it.each([true, false])("開く前の要素が接続中ならそこへ、切れていればトリガーへ戻す（接続中: %s）", async (connected) => {
    function Host({ open, keepPrevious }: { open: boolean; keepPrevious: boolean }) {
      return <>{keepPrevious && <button>元の要素</button>}<Panel name="パネル" open={open} onChange={() => {}} /></>;
    }
    const { rerender } = render(<Host open={false} keepPrevious />);
    const previous = screen.getByRole("button", { name: "元の要素" });
    previous.focus();
    rerender(<Host open keepPrevious />);
    await waitFor(() => expect(panelInput()).toHaveFocus());
    rerender(<Host open keepPrevious={connected} />);
    rerender(<Host open={false} keepPrevious={connected} />);
    await waitFor(() => expect(connected ? previous : panelTrigger()).toHaveFocus());
  });

  it("確定はフォーカスを同期で戻してから閉じる", async () => {
    const user = userEvent.setup();
    const closedAt = vi.fn();
    render(<SinglePanel onChange={(open) => { if (!open) closedAt(document.activeElement); }} />);
    await user.click(panelTrigger());
    await waitFor(() => expect(panelInput()).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "検索欄へ移動" }));
    expect(panelInput()).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "確定" }));
    expect(closedAt).toHaveBeenCalledExactlyOnceWith(panelTrigger());
    expect(panelTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("軸A→BではAが戻さず、BはAの開く前の要素を引き継ぐ", async () => {
    function Axes({ axis }: { axis: "A" | "B" | null }) {
      return <>
        <button>切替前</button>
        <Panel name="A" open={axis === "A"} restoreFocus={axis !== "B"} onChange={() => {}} />
        <Panel name="B" open={axis === "B"} onChange={() => {}} />
      </>;
    }
    const { rerender } = render(<Axes axis={null} />);
    const previous = screen.getByRole("button", { name: "切替前" });
    const focusPrevious = vi.spyOn(previous, "focus");
    previous.focus();
    focusPrevious.mockClear();
    rerender(<Axes axis="A" />);
    const a = await screen.findByRole("textbox", { name: "Aの検索欄" });
    await waitFor(() => expect(a).toHaveFocus());
    rerender(<Axes axis="B" />);
    const b = await screen.findByRole("textbox", { name: "Bの検索欄" });
    await waitFor(() => expect(b).toHaveFocus());
    await waitFor(() => expect(a).not.toBeInTheDocument());
    expect(b).toHaveFocus();
    expect(focusPrevious).not.toHaveBeenCalled();
    expect(resolveFocusReturnTarget(b)).toBe(previous);
    rerender(<Axes axis={null} />);
    await waitFor(() => expect(previous).toHaveFocus());
  });

  it("外側クリックで軸が切り替わっても、閉じたAの通知でBを閉じない", async () => {
    const user = userEvent.setup();
    const closed = vi.fn();
    function Axes() {
      const [axis, setAxis] = useState<"A" | "B" | null>(null);
      return (
        <>
          <Panel name="A" open={axis === "A"} restoreFocus={axis !== "B"} onChange={(open) => {
            if (!open) closed("A");
            setAxis(open ? "A" : null);
          }} />
          <button type="button" onClick={() => setAxis("B")}>Bへ切替</button>
          <Panel name="B" open={axis === "B"} onChange={(open) => {
            if (!open) closed("B");
            setAxis(open ? "B" : null);
          }} />
        </>
      );
    }
    render(<Axes />);
    await user.click(screen.getByRole("button", { name: "Aを開く" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Aの検索欄" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Bへ切替" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Bの検索欄" })).toHaveFocus());
    expect(closed).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(closed).toHaveBeenCalledExactlyOnceWith("B");
  });

  it("IMEのEscでは閉じず、変換中のキーも中身へ通さない", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    render(<SinglePanel onKeyDown={onKeyDown} />);
    await user.click(panelTrigger());
    const input = panelInput();
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.keyDown(input, { key: "Escape", isComposing: true });
    fireEvent.keyDown(input, { key: "Escape", keyCode: 229 });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(panelTrigger()).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(panelTrigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("共通の枠と呼び出し側の幅を付け、退出中のパネルをinertにする", async () => {
    const user = userEvent.setup();
    const contentRef = vi.fn();
    function Host() {
      const [open, setOpen] = useState(false);
      return <Panel name="パネル" open={open} onChange={setOpen} contentRef={contentRef} />;
    }
    render(<Host />);
    await user.click(panelTrigger());
    const content = screen.getByRole("dialog", { name: "パネル" });
    expect(contentRef).toHaveBeenLastCalledWith(content);
    expect(content).toHaveClass("z-50", "p-3", "w-60");
    expect(content).not.toHaveAttribute("inert");
    await waitFor(() => expect(panelInput()).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(content).toHaveAttribute("inert");
    await waitFor(() => expect(content).not.toBeInTheDocument());
    expect(contentRef).toHaveBeenLastCalledWith(null);
  });

  it("開いている間だけアンカーを含むスクロールで閉じる", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<><div data-testid="anchor-scroll"><SinglePanel onChange={changed} /></div><div data-testid="other-scroll" /></>);
    fireEvent.scroll(screen.getByTestId("anchor-scroll"));
    expect(changed).not.toHaveBeenCalled();
    await user.click(panelTrigger());
    await waitFor(() => expect(panelInput()).toHaveFocus());
    fireEvent.scroll(screen.getByTestId("other-scroll"));
    expect(changed).toHaveBeenCalledExactlyOnceWith(true);
    fireEvent.scroll(screen.getByTestId("anchor-scroll"));
    expect(changed.mock.calls).toEqual([[true], [false]]);
    await waitFor(() => expect(panelTrigger()).toHaveFocus());
    fireEvent.scroll(screen.getByTestId("anchor-scroll"));
    expect(changed.mock.calls).toEqual([[true], [false]]);
  });
});

describe("ポップオーバーとメニューの重なり", () => {
  it("Escはメニュー、ポップオーバーの順に閉じ、親dialogには渡さない", async () => {
    const user = userEvent.setup();
    const { onClose, unmount } = renderDialog();
    try {
      await openNestedMenu(user);
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
      expect(panelTrigger()).toHaveAttribute("aria-expanded", "true");
      expect(onClose).not.toHaveBeenCalled();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "パネル" })).toBeNull());
      expect(onClose).not.toHaveBeenCalled();
      await waitFor(() => expect(panelTrigger()).toHaveFocus());
      const dialog = screen.getByRole("dialog", { name: "親ダイアログ" });
      expect(fireEvent.keyDown(panelTrigger(), { key: "Escape" })).toBe(true);
      fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally { unmount(); }
  });

  it("ポップオーバーの外をクリックするとメニューごと閉じる", async () => {
    const user = userEvent.setup();
    const { onClose, unmount } = renderDialog();
    try {
      await openNestedMenu(user);
      const outside = screen.getByRole("button", { name: "外の操作" });
      await user.click(outside);
      await waitFor(() => expect(panelTrigger()).toHaveAttribute("aria-expanded", "false"));
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
      expect(outside).toHaveFocus();
      expect(onClose).not.toHaveBeenCalled();
    } finally { unmount(); }
  });

  it("backdropは開いているポップオーバーだけを閉じる", async () => {
    const user = userEvent.setup();
    const { onClose, unmount } = renderDialog();
    try {
      await user.click(panelTrigger());
      await waitFor(() => expect(panelInput()).toHaveFocus());
      const dialog = screen.getByRole("dialog", { name: "親ダイアログ" });
      await user.click(dialog);
      await waitFor(() => expect(panelTrigger()).toHaveAttribute("aria-expanded", "false"));
      await waitFor(() => expect(panelTrigger()).toHaveFocus());
      expect(onClose).not.toHaveBeenCalled();
      await user.click(dialog);
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally { unmount(); }
  });
});

it("IconButtonのsoftDisabledはArk Triggerを無効にしてフォーカスを残す", async () => {
  const user = userEvent.setup();
  const icon = () => null;
  const clicked = vi.fn();
  function Host({ softDisabled, disabled }: { softDisabled?: boolean; disabled?: boolean }) {
    const [open, setOpen] = useState(false);
    const handle = useMotionPopover({ open, onOpenChange: (details) => setOpen(details.open) });
    return <MotionPopoverRoot handle={handle}>
      <Popover.Trigger asChild>
        <IconButton icon={icon} label="追加" onClick={clicked} softDisabled={softDisabled} disabled={disabled} />
      </Popover.Trigger>
      <PopoverPopup aria-label="追加パネル"><input aria-label="追加項目" /></PopoverPopup>
    </MotionPopoverRoot>;
  }
  const { rerender } = render(<Host />);
  const button = screen.getByRole("button", { name: "追加" });
  button.focus();
  rerender(<Host softDisabled />);
  expect(button).toHaveFocus();
  expect(button).toHaveAttribute("aria-disabled", "true");
  expect(button).not.toBeDisabled();
  await user.click(button);
  await user.keyboard("{Enter}");
  await user.keyboard("[Space]");
  expect(button).toHaveFocus();
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(clicked).not.toHaveBeenCalled();
  rerender(<Host disabled />);
  expect(button).toBeDisabled();
});

it("useElementWidthは要素の幅を監視し、監視先が無くなれば解除する", () => {
  const element = document.createElement("div");
  const measure = vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 300, 20));
  function Width({ target }: { target: HTMLElement | null }) {
    return <output aria-label="幅">{useElementWidth(target) ?? "なし"}</output>;
  }
  const { rerender } = render(<Width target={element} />);
  const observer = getResizeObservers().find((item) => item.getObserved().includes(element));
  expect(observer).toBeDefined();
  expect(screen.getByLabelText("幅")).toHaveTextContent("300");
  const resized = new DOMRect(0, 0, 340, 20);
  measure.mockReturnValue(resized);
  act(() => observer?.flush([{ target: element, contentRect: resized }]));
  expect(screen.getByLabelText("幅")).toHaveTextContent("340");
  rerender(<Width target={null} />);
  expect(observer?.getObserved()).toEqual([]);
  expect(screen.getByLabelText("幅")).toHaveTextContent("なし");
});
