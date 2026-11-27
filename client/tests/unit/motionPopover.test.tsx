import { useRef, useState, type ReactNode } from "react";
import { Menu } from "@ark-ui/react/menu";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import IconButton from "../../src/shared/ui/IconButton";
import { I } from "../../src/shared/ui/Icon";
import { resolveFocusReturnTarget } from "../../src/shared/ui/layer/focusReturnTarget";
import {
  MenuPopup,
  MotionMenuRoot,
  MotionMenuTrigger,
  useMotionMenu,
} from "../../src/shared/ui/menu/MotionMenu";
import {
  MotionPopoverRoot,
  MotionPopoverTrigger,
  PopoverPopup,
  useMotionPopover,
} from "../../src/shared/ui/popover/MotionPopover";
import { useDialogModal } from "../../src/shared/ui/useDialogModal";

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
      <MotionPopoverTrigger>
        <button type="button">{name}を開く</button>
      </MotionPopoverTrigger>
      <PopoverPopup ref={contentRef} aria-label={name} onKeyDown={onKeyDown}>
        <input ref={input} aria-label={`${name}の検索欄`} />
        <button type="button" onClick={handle.closeAndReturn}>
          確定
        </button>
        <button type="button" onClick={handle.focusInitial}>
          検索欄へ移動
        </button>
        {children}
      </PopoverPopup>
    </MotionPopoverRoot>
  );
}

function SinglePanel({
  onChange,
  children,
  onKeyDown,
}: {
  onChange?: (open: boolean) => void;
  children?: ReactNode;
  onKeyDown?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Panel
      name="パネル"
      open={open}
      onChange={(next) => {
        onChange?.(next);
        setOpen(next);
      }}
      onKeyDown={onKeyDown}
    >
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
      <MotionMenuTrigger>
        <button type="button">メニューを開く</button>
      </MotionMenuTrigger>
      <MenuPopup>
        <Menu.Item value="item">メニュー項目</Menu.Item>
      </MenuPopup>
    </MotionMenuRoot>
  );
}

function DialogHost({ onClose }: { onClose: () => void }) {
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose });
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- 背景クリックはuseDialogModalで判定する。EscapeはonCancel（useDialogModal）で処理する。
    <dialog
      aria-label="親ダイアログ"
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event)}
    >
      <SinglePanel>
        <NestedMenu />
      </SinglePanel>
      <button type="button">外の操作</button>
    </dialog>
  );
}

function renderDialog(onClose = vi.fn()) {
  // happy-dom は native dialog の開閉と Esc → cancel を再現しない。
  const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
  const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
  const restore = () => {
    if (showModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModal);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    if (close) Object.defineProperty(HTMLDialogElement.prototype, "close", close);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  };
  const view = render(<DialogHost onClose={onClose} />);
  return {
    onClose,
    unmount() {
      try {
        view.unmount();
      } finally {
        restore();
      }
    },
  };
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
    render(
      <>
        <SinglePanel />
        <input aria-label="外の入力" />
      </>,
    );
    await user.click(panelTrigger());
    await waitFor(() => expect(panelInput()).toHaveFocus());
    const outside = screen.getByRole("textbox", { name: "外の入力" });
    act(() => outside.focus());
    await waitFor(() => expect(panelTrigger()).toHaveAttribute("aria-expanded", "false"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "パネル" })).toBeNull());
    expect(outside).toHaveFocus();
  });

  it.each([true, false])(
    "開く前の要素が接続中ならそこへ、切れていればトリガーへ戻す（接続中: %s）",
    async (connected) => {
      function Host({ open, keepPrevious }: { open: boolean; keepPrevious: boolean }) {
        return (
          <>
            {keepPrevious && <button>元の要素</button>}
            <Panel name="パネル" open={open} onChange={() => {}} />
          </>
        );
      }
      const { rerender } = render(<Host open={false} keepPrevious />);
      const previous = screen.getByRole("button", { name: "元の要素" });
      previous.focus();
      rerender(<Host open keepPrevious />);
      await waitFor(() => expect(panelInput()).toHaveFocus());
      rerender(<Host open keepPrevious={connected} />);
      rerender(<Host open={false} keepPrevious={connected} />);
      await waitFor(() => expect(connected ? previous : panelTrigger()).toHaveFocus());
    },
  );

  it("確定はフォーカスを同期で戻してから閉じる", async () => {
    const user = userEvent.setup();
    const closedAt = vi.fn();
    render(
      <SinglePanel
        onChange={(open) => {
          if (!open) closedAt(document.activeElement);
        }}
      />,
    );
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
      return (
        <>
          <button>切替前</button>
          <Panel name="A" open={axis === "A"} restoreFocus={axis !== "B"} onChange={() => {}} />
          <Panel name="B" open={axis === "B"} onChange={() => {}} />
        </>
      );
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
          <Panel
            name="A"
            open={axis === "A"}
            restoreFocus={axis !== "B"}
            onChange={(open) => {
              if (!open) closed("A");
              setAxis(open ? "A" : null);
            }}
          />
          <button type="button" onClick={() => setAxis("B")}>
            Bへ切替
          </button>
          <Panel
            name="B"
            open={axis === "B"}
            onChange={(open) => {
              if (!open) closed("B");
              setAxis(open ? "B" : null);
            }}
          />
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

  it("退出中のパネルをinertにする", async () => {
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
    render(
      <>
        <div data-testid="anchor-scroll">
          <SinglePanel onChange={changed} />
        </div>
        <div data-testid="other-scroll" />
      </>,
    );
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
    } finally {
      unmount();
    }
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
    } finally {
      unmount();
    }
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
    } finally {
      unmount();
    }
  });
});

describe("無効なトリガー", () => {
  function DisabledHost({ disabled }: { disabled: boolean }) {
    const [open, setOpen] = useState(false);
    const handle = useMotionPopover({
      open,
      disabled,
      onOpenChange: (details) => setOpen(details.open),
    });
    return (
      <MotionPopoverRoot handle={handle}>
        <MotionPopoverTrigger>
          <IconButton icon={I.add} label="追加" />
        </MotionPopoverTrigger>
        <PopoverPopup aria-label="追加パネル">
          <input aria-label="追加項目" />
        </PopoverPopup>
      </MotionPopoverRoot>
    );
  }

  it("フォーカスを残したまま、ポインターでもキーでも開かない", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DisabledHost disabled={false} />);
    const button = screen.getByRole("button", { name: "追加" });
    button.focus();
    rerender(<DisabledHost disabled />);
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("data-disabled");
    expect(button).not.toBeDisabled();
    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard("[Space]");
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog", { name: "追加パネル" })).toBeNull();
    rerender(<DisabledHost disabled={false} />);
    await user.click(button);
    expect(screen.getByRole("dialog", { name: "追加パネル" })).toBeInTheDocument();
  });
});

describe("層の中のイベント", () => {
  it("ポータルした層の中のクリック・キーは、React の祖先へ伝えない", async () => {
    const user = userEvent.setup();
    const ancestor = vi.fn();
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- 祖先への伝播を確かめる
        <div onClick={ancestor} onKeyDown={ancestor} onPointerDown={ancestor}>
          <Panel name="パネル" open={open} onChange={setOpen} />
        </div>
      );
    }
    render(<Host />);
    await user.click(panelTrigger());
    await waitFor(() => expect(panelInput()).toHaveFocus());
    ancestor.mockClear();
    await user.click(panelInput());
    await user.keyboard("a");
    expect(ancestor).not.toHaveBeenCalled();
  });
});
