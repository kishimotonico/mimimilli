// useAnchoredPopover / usePopoverDismissal のフォーカス復帰・外側クリック/Escape挙動のテスト。
// タグ追加ポップオーバーのEscape・並び替えメニューの項目選択・編集モーダル末尾からのTabの
// 3箇所で共通するBODYフォーカス落ち欠陥（doc-4）の共通修正の単体テスト。
import { createElement, useRef, useState } from "react";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useAnchoredPopover,
  usePopoverDismissal,
} from "../../src/features/library/ui/preview/useAnchoredPopover";

afterEach(() => {
  cleanup();
});

function AnchoredPopoverHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const closePopover = () => setIsOpen(false);
  const { anchorRef, layout } = useAnchoredPopover({
    isOpen,
    preferredWidth: 200,
    onOutsideClick: closePopover,
    onEscape: closePopover,
  });

  return createElement(
    "div",
    { ref: anchorRef, style: { position: "relative" } },
    createElement("button", { onClick: () => setIsOpen((v) => !v) }, "トリガー"),
    isOpen &&
      createElement(
        "div",
        { role: "menu", style: { left: layout.left, width: layout.width } },
        createElement("button", { onClick: closePopover }, "項目を選択"),
      ),
  );
}

function DismissalHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  usePopoverDismissal({
    isOpen,
    onOutsideClick: () => setIsOpen(false),
    onEscape: () => setIsOpen(false),
    anchorRef,
  });

  return createElement(
    "div",
    { ref: anchorRef },
    createElement("button", { onClick: () => setIsOpen((v) => !v) }, "トリガー"),
    isOpen && createElement("button", { "data-testid": "menu-item" }, "項目"),
  );
}

describe("useAnchoredPopover", () => {
  it("Escapeで閉じるとトリガーへフォーカスが戻る", () => {
    render(createElement(AnchoredPopoverHarness));
    fireEvent.click(screen.getByRole("button", { name: "トリガー" }));

    const item = screen.getByRole("button", { name: "項目を選択" });
    item.focus();
    expect(item).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "トリガー" })).toHaveFocus();
  });

  it("項目選択でポップオーバーが閉じてもトリガーへフォーカスが戻る", () => {
    render(createElement(AnchoredPopoverHarness));
    fireEvent.click(screen.getByRole("button", { name: "トリガー" }));

    const item = screen.getByRole("button", { name: "項目を選択" });
    item.focus();
    fireEvent.click(item);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "トリガー" })).toHaveFocus();
  });

  it("外側クリックで閉じたときは、既にフォーカス中の要素を奪わない", () => {
    render(
      createElement(
        "div",
        null,
        createElement(AnchoredPopoverHarness),
        createElement("button", { "data-testid": "outside" }, "外側"),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "トリガー" }));

    const outside = screen.getByTestId("outside");
    outside.focus();
    fireEvent.pointerDown(outside);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(outside).toHaveFocus();
  });
});

describe("usePopoverDismissal", () => {
  it("開いている間だけ外側クリック/Escapeで閉じる", () => {
    render(createElement(DismissalHarness));
    const trigger = screen.getByRole("button", { name: "トリガー" });
    fireEvent.click(trigger);
    expect(screen.getByTestId("menu-item")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("menu-item")).not.toBeInTheDocument();
  });

  it("閉じたときBODYにフォーカスが落ちていればアンカー内の最初の要素へ戻す", () => {
    render(createElement(DismissalHarness));
    const trigger = screen.getByRole("button", { name: "トリガー" });
    fireEvent.click(trigger);

    const item = screen.getByTestId("menu-item");
    item.focus();
    // 項目がアンマウントされてBODYへフォーカスが落ちる状況を再現する
    fireEvent.click(trigger);

    expect(document.activeElement).toBe(trigger);
  });

  it("onOutsideClick/onEscape はダミー関数でも例外なく呼べる", () => {
    const onOutsideClick = vi.fn();
    const onEscape = vi.fn();
    function Harness() {
      const anchorRef = useRef<HTMLDivElement>(null);
      usePopoverDismissal({ isOpen: true, onOutsideClick, onEscape, anchorRef });
      return createElement("div", { ref: anchorRef }, createElement("button", null, "x"));
    }
    render(createElement(Harness));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(document.body);
    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });
});
