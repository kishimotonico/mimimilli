// useAnchoredPopover / usePopoverDismissal のフォーカス復帰・外側クリック/Escape挙動のテスト。
import { createElement, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fireEvent, render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AxisFacetItem } from "@mimimilli/shared";
import AxisValueQuickList from "../../src/features/library/ui/AxisValueQuickList";
import {
  useAnchoredPopover,
  usePopoverDismissal,
} from "../../src/features/library/ui/preview/useAnchoredPopover";
import { clearResizeObservers, flushAllResizeObservers, mockElementSize } from "./setup";

afterEach(() => {
  cleanup();
  clearResizeObservers();
});

function AnchoredPopoverHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const { anchorRef, layout, close } = useAnchoredPopover({
    isOpen,
    preferredWidth: 200,
    onClose: () => setIsOpen(false),
  });

  return createElement(
    "div",
    { ref: anchorRef, style: { position: "relative" } },
    createElement("button", { onClick: () => setIsOpen((v) => !v) }, "トリガー"),
    isOpen &&
      createElement(
        "div",
        { role: "menu", style: { left: layout.left, width: layout.width } },
        createElement("button", { onClick: () => close() }, "項目を選択"),
      ),
  );
}

function DismissalHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const { close } = usePopoverDismissal({
    isOpen,
    onClose: () => setIsOpen(false),
    anchorRef,
  });

  return createElement(
    "div",
    { ref: anchorRef },
    createElement("button", { onClick: () => setIsOpen((v) => !v) }, "トリガー"),
    isOpen &&
      createElement("button", { "data-testid": "menu-item", onClick: () => close() }, "項目"),
  );
}

const QUICK_LIST_ITEMS: AxisFacetItem[] = [
  { value: "声優A", count: 3, durationSec: 0, covers: [] },
  { value: "声優B", count: 2, durationSec: 0, covers: [] },
];

function QuickListWithDismissalHarness() {
  const [overlay, setOverlay] = useState(true);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { close } = usePopoverDismissal({
    isOpen: overlay,
    onClose: () => setOverlay(false),
    anchorRef,
    additionalBoundaryRefs: [panelRef],
  });

  return createElement(
    "div",
    null,
    createElement("button", { ref: anchorRef, "data-testid": "anchor-btn" }, "anchor"),
    overlay &&
      createPortal(
        createElement(
          "div",
          { ref: panelRef },
          createElement(AxisValueQuickList, {
            axis: "cv",
            axisLabel: "CV",
            items: QUICK_LIST_ITEMS,
            isSelected: () => false,
            onSelect: () => close(),
            close,
          }),
        ),
        document.body,
      ),
    createElement("button", { "data-testid": "outside-btn" }, "outside"),
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

  it("close() で閉じたときBODYにフォーカスが落ちていればアンカー内の最初の要素へ戻す", () => {
    render(createElement(DismissalHarness));
    const trigger = screen.getByRole("button", { name: "トリガー" });
    fireEvent.click(trigger);

    const item = screen.getByTestId("menu-item");
    item.focus();
    fireEvent.click(item);

    expect(document.activeElement).toBe(trigger);
  });

  it("Escape で onClose が escape 理由で呼ばれる", () => {
    const onClose = vi.fn();
    function Harness() {
      const anchorRef = useRef<HTMLDivElement>(null);
      usePopoverDismissal({ isOpen: true, onClose, anchorRef });
      return createElement("div", { ref: anchorRef }, createElement("button", null, "x"));
    }
    render(createElement(Harness));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith("escape");
  });

  it("外側クリックで onClose が outside 理由で呼ばれる", () => {
    const onClose = vi.fn();
    function Harness() {
      const anchorRef = useRef<HTMLDivElement>(null);
      usePopoverDismissal({ isOpen: true, onClose, anchorRef });
      return createElement("div", { ref: anchorRef }, createElement("button", null, "x"));
    }
    render(createElement(Harness));
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledWith("outside");
  });

  it("additionalBoundaryRefs 内のクリックでは onClose を呼ばない", () => {
    const onClose = vi.fn();
    function Harness() {
      const anchorRef = useRef<HTMLDivElement>(null);
      const panelRef = useRef<HTMLDivElement>(null);
      usePopoverDismissal({
        isOpen: true,
        onClose,
        anchorRef,
        additionalBoundaryRefs: [panelRef],
      });
      return createElement(
        "div",
        null,
        createElement("div", { ref: anchorRef }, createElement("button", null, "anchor")),
        createElement("div", { ref: panelRef, "data-testid": "panel" }, "panel"),
      );
    }
    render(createElement(Harness));
    fireEvent.pointerDown(screen.getByTestId("panel"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("close() は1回の閉じ操作でフォーカス復帰を1回だけ行う", () => {
    render(createElement(DismissalHarness));
    const trigger = screen.getByRole("button", { name: "トリガー" });
    fireEvent.click(trigger);
    const focusSpy = vi.spyOn(trigger, "focus");

    const item = screen.getByTestId("menu-item");
    item.focus();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(focusSpy.mock.calls.length).toBe(1);
    focusSpy.mockRestore();
  });
});

describe("AxisValueQuickList 経路での close()", () => {
  it("検索欄で Escape するとアンカーへフォーカスが戻る", async () => {
    const sizeMock = mockElementSize(260, 260);
    render(createElement(QuickListWithDismissalHarness));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 260, height: 260 });
    });
    const anchor = screen.getByTestId("anchor-btn");
    const focusSpy = vi.spyOn(anchor, "focus");

    const input = screen.getByPlaceholderText("CVを検索");
    input.focus();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByPlaceholderText("CVを検索")).not.toBeInTheDocument();
    expect(anchor).toHaveFocus();
    expect(focusSpy.mock.calls.length).toBe(1);
    focusSpy.mockRestore();
    sizeMock.restore();
  });

  it("外側クリックで閉じたときもアンカーへフォーカスが戻る", async () => {
    const sizeMock = mockElementSize(260, 260);
    render(createElement(QuickListWithDismissalHarness));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 260, height: 260 });
    });
    const anchor = screen.getByTestId("anchor-btn");
    const focusSpy = vi.spyOn(anchor, "focus");

    const input = screen.getByPlaceholderText("CVを検索");
    input.focus();
    fireEvent.pointerDown(screen.getByTestId("outside-btn"));

    expect(screen.queryByPlaceholderText("CVを検索")).not.toBeInTheDocument();
    expect(anchor).toHaveFocus();
    expect(focusSpy.mock.calls.length).toBe(1);
    focusSpy.mockRestore();
    sizeMock.restore();
  });

  it("値行を選択して閉じたときもアンカーへフォーカスが戻る", async () => {
    const sizeMock = mockElementSize(260, 260);
    render(createElement(QuickListWithDismissalHarness));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 260, height: 260 });
    });
    const anchor = screen.getByTestId("anchor-btn");
    const focusSpy = vi.spyOn(anchor, "focus");

    const firstItem = document.querySelector<HTMLButtonElement>("[data-quicklist-item]");
    expect(firstItem).toBeTruthy();
    firstItem!.focus();
    await userEvent.click(firstItem!);

    expect(screen.queryByPlaceholderText("CVを検索")).not.toBeInTheDocument();
    expect(anchor).toHaveFocus();
    expect(focusSpy.mock.calls.length).toBe(1);
    focusSpy.mockRestore();
    sizeMock.restore();
  });
});
