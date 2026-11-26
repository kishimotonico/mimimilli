// ポップオーバーのEscapeは、アンカーが属するダイアログ（なければdocument）の範囲で受ける。
import { useRef, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider as JotaiProvider } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openModalDialogsAtom } from "../../src/shared/model/openModalDialogsAtom";
import RegisterFieldsPopover from "../../src/features/scan/ui/scanModal/unregistered/RegisterFieldsPopover";
import { usePopoverEscape } from "../../src/shared/ui/usePopoverEscape";

afterEach(cleanup);

function TestMenu({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  usePopoverEscape(
    open,
    () => anchorRef.current,
    () => setOpen(false),
  );
  return (
    <div ref={anchorRef}>
      <button type="button" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div role="menu">
          <div role="menuitem">{`${label}の項目`}</div>
        </div>
      )}
    </div>
  );
}

function openMenu(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  expect(screen.getByRole("menuitem", { name: `${label}の項目` })).not.toBeNull();
}

describe("ポップオーバーのEscape", () => {
  it("同じダイアログのメニュー外にフォーカスがあっても、メニューだけを閉じて既定動作を止める", () => {
    render(
      <dialog open>
        <TestMenu label="メニュー" />
        <input aria-label="入力" />
      </dialog>,
    );
    openMenu("メニュー");
    const input = screen.getByLabelText("入力");
    input.focus();
    expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(true);
  });

  it("背面のダイアログで開いたままのメニューは、前面のダイアログのEscapeを奪わない", () => {
    const onFrontKeyDown = vi.fn();
    render(
      <>
        <dialog open>
          <TestMenu label="背面のメニュー" />
        </dialog>
        <dialog open onKeyDown={onFrontKeyDown}>
          <button type="button">前面のボタン</button>
        </dialog>
      </>,
    );
    openMenu("背面のメニュー");
    const front = screen.getByRole("button", { name: "前面のボタン" });
    front.focus();
    expect(fireEvent.keyDown(front, { key: "Escape" })).toBe(true);
    expect(onFrontKeyDown).toHaveBeenCalledOnce();
    expect(screen.getByRole("menu")).not.toBeNull();
  });

  it("ダイアログの外のメニューは、ダイアログの中のEscapeを奪わない", () => {
    render(
      <>
        <TestMenu label="外のメニュー" />
        <dialog open>
          <button type="button">ダイアログ内</button>
        </dialog>
      </>,
    );
    openMenu("外のメニュー");
    const inner = screen.getByRole("button", { name: "ダイアログ内" });
    expect(fireEvent.keyDown(inner, { key: "Escape" })).toBe(true);
    expect(screen.getByRole("menu")).not.toBeNull();
  });

  it("IME変換中のEscapeは無視する", () => {
    render(
      <dialog open>
        <TestMenu label="メニュー" />
      </dialog>,
    );
    openMenu("メニュー");
    const trigger = screen.getByRole("button", { name: "メニュー" });
    expect(fireEvent.keyDown(trigger, { key: "Escape", isComposing: true })).toBe(true);
    expect(screen.getByRole("menu")).not.toBeNull();
  });

  it("フォーカスが body にあるときは、最前面のモーダルの中のメニューだけが閉じる", () => {
    const store = createStore();
    render(
      <JotaiProvider store={store}>
        <dialog open data-testid="back">
          <TestMenu label="背面のメニュー" />
        </dialog>
        <dialog open data-testid="front">
          <TestMenu label="前面のメニュー" />
        </dialog>
      </JotaiProvider>,
    );
    store.set(openModalDialogsAtom, [screen.getByTestId("back"), screen.getByTestId("front")]);
    openMenu("背面のメニュー");
    openMenu("前面のメニュー");
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);

    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(false);
    expect(screen.queryByRole("menuitem", { name: "前面のメニューの項目" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "背面のメニューの項目" })).not.toBeNull();
    expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(true);
  });

  it("同じ範囲に複数開いているときは、あとから開いたものから閉じる", () => {
    render(
      <>
        <TestMenu label="先" />
        <TestMenu label="後" />
      </>,
    );
    openMenu("先");
    openMenu("後");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.queryByRole("menuitem", { name: "後の項目" })).toBeNull();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("追加項目のポップオーバーも、ダイアログ内でフォーカスが外にあるときEscapeで閉じる", () => {
    const onClose = vi.fn();
    function Host() {
      const anchorRef = { current: null as HTMLDivElement | null };
      return (
        <dialog open>
          <div
            ref={(node) => {
              anchorRef.current = node;
            }}
          >
            <RegisterFieldsPopover
              count={1}
              disabled={false}
              anchorRef={anchorRef}
              onSubmit={() => {}}
              onClose={onClose}
            />
          </div>
          <input aria-label="外の入力" />
        </dialog>
      );
    }
    render(<Host />);
    const outside = screen.getByLabelText("外の入力");
    outside.focus();
    expect(fireEvent.keyDown(outside, { key: "Escape" })).toBe(false);
    expect(onClose).toHaveBeenCalledWith("escape");
  });
});
