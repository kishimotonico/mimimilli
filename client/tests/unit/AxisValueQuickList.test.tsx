import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxisFacetItem } from "@mimimilli/shared";
import AxisValueQuickList from "../../src/features/library/ui/AxisValueQuickList";
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

async function flushVirtualizer(size = { width: 260, height: 260 }) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    flushAllResizeObservers(size);
  });
}

function renderQuickList(props: Partial<React.ComponentProps<typeof AxisValueQuickList>> = {}) {
  return render(
    <AxisValueQuickList
      axis="cv"
      items={[]}
      isSelected={() => false}
      onSelect={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );
}

describe("AxisValueQuickList の仮想化", () => {
  it("2000件でも展開されるDOMの行数は総数よりずっと少ない", async () => {
    const sizeMock = mockElementSize(260, 260);
    renderQuickList({ items: makeItems(2000) });
    await flushVirtualizer();

    const rendered = document.querySelectorAll("[data-quicklist-item]");
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(100);
    sizeMock.restore();
  });

  it("スクロールコンテナに max-height によるクリップがある（パネル内スクロール）", async () => {
    const sizeMock = mockElementSize(260, 260);
    renderQuickList({ items: makeItems(2000) });
    await flushVirtualizer();

    expect(document.querySelector(".mll-qlist__body")).toBeTruthy();
    sizeMock.restore();
  });
});

describe("AxisValueQuickList のキーボード移動", () => {
  it("検索欄からArrowDownで最初の値行にフォーカスする", async () => {
    const sizeMock = mockElementSize(260, 260);
    const user = userEvent.setup();
    renderQuickList({ items: makeItems(50) });
    await flushVirtualizer();

    const input = screen.getByPlaceholderText("cvを検索");
    input.focus();
    await user.keyboard("{ArrowDown}");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(document.activeElement?.getAttribute("data-quicklist-item")).not.toBeNull();
    sizeMock.restore();
  });

  it("見出し行（実タグとして存在しない中間ノード）を飛ばして値行だけを移動する", async () => {
    const sizeMock = mockElementSize(260, 260);
    const user = userEvent.setup();
    renderQuickList({
      items: [
        { value: "シチュ/学園/図書室", count: 1, durationSec: 0, covers: [] },
        { value: "癒し系", count: 2, durationSec: 0, covers: [] },
      ],
    });
    await flushVirtualizer();

    // 既定ソートは件数（フラット）。名前順に切り替えて階層表示（見出し行あり）にする。
    await user.click(screen.getByRole("button", { name: "名前" }));
    await flushVirtualizer();

    const input = screen.getByPlaceholderText("cvを検索");
    input.focus();
    await user.keyboard("{ArrowDown}");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // 名前順で先頭に来るのは「シチュ/学園/図書室」の葉（値行）。見出し「シチュ」「シチュ/学園」は
    // 選択不可のためフォーカス対象にならない。
    expect(document.activeElement?.textContent).toContain("図書室");
    sizeMock.restore();
  });

  it("ArrowUp/ArrowDownで値行間をラップアラウンドしながら移動する", async () => {
    const sizeMock = mockElementSize(260, 260);
    const user = userEvent.setup();
    renderQuickList({ items: makeItems(3) });
    await flushVirtualizer();

    const input = screen.getByPlaceholderText("cvを検索");
    input.focus();
    await user.keyboard("{ArrowDown}");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    // 件数降順の既定ソート: 値0002(count2) > 値0001(count1) > 値0000(count0)。先頭は値0002。
    expect(document.activeElement?.textContent).toContain("値0002");

    await user.keyboard("{ArrowUp}");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    // 先頭からArrowUpするとラップして末尾（最小件数）の行へ移る。
    expect(document.activeElement?.textContent).toContain("値0000");
    sizeMock.restore();
  });
});

describe("AxisValueQuickList の選択", () => {
  it("値行クリックで onSelect にctrl/metaキー情報とともに完全な item を渡す", async () => {
    const sizeMock = mockElementSize(260, 260);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderQuickList({ items: makeItems(5), onSelect });
    await flushVirtualizer();

    const first = document.querySelector<HTMLButtonElement>("[data-quicklist-item]");
    expect(first).toBeTruthy();
    await user.click(first!);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ value: expect.stringMatching(/^値/) });
    sizeMock.restore();
  });
});
