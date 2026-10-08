import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxisFacetItem } from "@mimimilli/shared";
import AxisValueRows from "../../src/features/library/ui/AxisValueRows";
import { flattenAxisValueRows } from "../../src/features/library/model/axisValueHierarchy";
import { clearResizeObservers, flushAllResizeObservers, mockElementSize } from "./setup";

afterEach(() => {
  cleanup();
  clearResizeObservers();
});

function makeItems(count: number): AxisFacetItem[] {
  return Array.from({ length: count }, (_, i) => ({
    value: `値${String(i).padStart(4, "0")}`,
    count: i,
    durationSec: 0,
    covers: [],
  }));
}

async function flush(size = { width: 400, height: 400 }) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    flushAllResizeObservers(size);
  });
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
}

function renderRows(items: AxisFacetItem[], onSelect = vi.fn()) {
  return render(
    <AxisValueRows
      axisLabel="CV"
      rows={flattenAxisValueRows(items)}
      sort={{ key: "name", direction: "asc" }}
      onSortChange={vi.fn()}
      isSelected={() => false}
      fallbackIcon="user"
      resetKey="cv:name:asc"
      onSelect={onSelect}
    />,
  );
}

function rowButtons() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("[data-flat-index]"));
}

describe("AxisValueRows のキーボード移動", () => {
  it("roving tabindex: 未操作では描画中の先頭行だけがtabIndex 0、矢印移動後は現在位置の行だけが0", async () => {
    const sizeMock = mockElementSize(400, 400);
    const user = userEvent.setup();
    renderRows(makeItems(5));
    await flush();

    const initial = rowButtons().filter((b) => b.tabIndex === 0);
    expect(initial).toHaveLength(1);
    expect(initial[0]?.getAttribute("data-flat-index")).toBe("0");

    initial[0]?.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await settle();

    expect(document.activeElement?.getAttribute("data-flat-index")).toBe("2");
    const tabbable = rowButtons().filter((b) => b.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]?.getAttribute("data-flat-index")).toBe("2");
    sizeMock.restore();
  });

  it("ArrowUp/ArrowDownで移動し、端ではクランプする", async () => {
    const sizeMock = mockElementSize(400, 400);
    const user = userEvent.setup();
    renderRows(makeItems(3));
    await flush();

    rowButtons()[0]?.focus();
    await user.keyboard("{ArrowUp}");
    await settle();
    expect(document.activeElement?.getAttribute("data-flat-index")).toBe("0");

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    await settle();
    expect(document.activeElement?.getAttribute("data-flat-index")).toBe("2");
    sizeMock.restore();
  });

  it("Homeで先頭、Endで末尾の値行へ移動する", async () => {
    const sizeMock = mockElementSize(400, 400);
    const user = userEvent.setup();
    renderRows(makeItems(4));
    await flush();

    rowButtons()[1]?.focus();
    await user.keyboard("{End}");
    await settle();
    expect(document.activeElement?.getAttribute("data-flat-index")).toBe("3");

    await user.keyboard("{Home}");
    await settle();
    expect(document.activeElement?.getAttribute("data-flat-index")).toBe("0");
    sizeMock.restore();
  });

  it("見出し行（実タグとして存在しない中間ノード）を飛ばして値行だけを移動する", async () => {
    const sizeMock = mockElementSize(400, 400);
    const user = userEvent.setup();
    renderRows([
      { value: "シチュ/学園/図書室", count: 1, durationSec: 0, covers: [] },
      { value: "癒し系", count: 2, durationSec: 0, covers: [] },
    ]);
    await flush();

    const buttons = rowButtons();
    expect(buttons.map((b) => b.textContent)).toEqual([
      expect.stringContaining("図書室"),
      expect.stringContaining("癒し系"),
    ]);
    buttons[0]?.focus();
    await user.keyboard("{ArrowDown}");
    await settle();
    expect(document.activeElement?.textContent).toContain("癒し系");
    sizeMock.restore();
  });

  it("移動先へフォーカスし、画面内へスクロールする（preventScroll + scrollIntoView）", async () => {
    const sizeMock = mockElementSize(400, 400);
    const user = userEvent.setup();
    renderRows(makeItems(5));
    await flush();

    const first = rowButtons()[0];
    first?.focus();
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView");
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");
    await user.keyboard("{ArrowDown}");
    await settle();

    expect(focusSpy).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockRestore();
    focusSpy.mockRestore();
    sizeMock.restore();
  });

  it("マウント時・データ更新時にはスクロールもフォーカス移動もしない", async () => {
    const sizeMock = mockElementSize(400, 400);
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView");
    const { rerender } = renderRows(makeItems(5));
    await flush();
    rerender(
      <AxisValueRows
        axisLabel="CV"
        rows={flattenAxisValueRows(makeItems(6))}
        sort={{ key: "name", direction: "asc" }}
        onSortChange={vi.fn()}
        isSelected={() => false}
        fallbackIcon="user"
        resetKey="cv:name:asc"
        onSelect={vi.fn()}
      />,
    );
    await flush();
    await settle();

    expect(scrollSpy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
    scrollSpy.mockRestore();
    sizeMock.restore();
  });

  it("Enterでフォーカス中の値を選択する", async () => {
    const sizeMock = mockElementSize(400, 400);
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderRows(makeItems(3), onSelect);
    await flush();

    rowButtons()[0]?.focus();
    await user.keyboard("{ArrowDown}");
    await settle();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ value: "値0001" });
    expect(screen.getByRole("group", { name: "CVの値一覧" })).toBeInTheDocument();
    sizeMock.restore();
  });
});
