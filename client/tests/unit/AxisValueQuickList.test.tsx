import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider, createStore } from "jotai";
import type { AxisFacetItem } from "@mimimilli/shared";
import AxisValueQuickList from "../../src/features/library/ui/AxisValueQuickList";
import { axisValueSortAtom } from "../../src/features/library/model/atoms";
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
  const store = createStore();
  const result = render(
    <JotaiProvider store={store}>
      <AxisValueQuickList
        axis="cv"
        axisLabel="CV"
        items={[]}
        isSelected={() => false}
        onSelect={vi.fn()}
        close={vi.fn()}
        {...props}
      />
    </JotaiProvider>,
  );
  return { ...result, store };
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

  // パネル内スクロール（max-height + overflow-y）はCSSクリップの検証であり、
  // レイアウト計算をしないhappy-domでは実効性のあるアサーションにできない。
  // ブラウザでの実機確認（agent-browser）で担保する。
});

describe("AxisValueQuickList のキーボード移動", () => {
  it("検索欄からArrowDownで最初の値行にフォーカスする", async () => {
    const sizeMock = mockElementSize(260, 260);
    const user = userEvent.setup();
    renderQuickList({ items: makeItems(50) });
    await flushVirtualizer();

    const input = screen.getByPlaceholderText("CVを検索");
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

    // 既定ソートは件数（フラット）。ソートはアイコンボタンからインライン展開し、
    // 名前順に切り替えて階層表示（見出し行あり）にする。
    await user.click(screen.getByRole("button", { name: /^並び替え/ }));
    await user.click(screen.getByRole("button", { name: "名前" }));
    await flushVirtualizer();

    const input = screen.getByPlaceholderText("CVを検索");
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

    const input = screen.getByPlaceholderText("CVを検索");
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

  it("位置未確定の状態からのArrowUpは末尾の値行へ着地する", async () => {
    const sizeMock = mockElementSize(260, 260);
    const user = userEvent.setup();
    renderQuickList({ items: makeItems(3) });
    await flushVirtualizer();

    const input = screen.getByPlaceholderText("CVを検索");
    input.focus();
    await user.keyboard("{ArrowUp}");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // 件数降順の既定ソート: 値0002 > 値0001 > 値0000。末尾は最小件数の値0000。
    expect(document.activeElement?.textContent).toContain("値0000");
    sizeMock.restore();
  });

  it("items だけが変わっても activeIndexRef はリセットされず、位置を維持したまま移動する", async () => {
    const sizeMock = mockElementSize(260, 260);
    const user = userEvent.setup();
    const store = createStore();
    const { rerender } = render(
      <JotaiProvider store={store}>
        <AxisValueQuickList
          axis="cv"
          axisLabel="CV"
          items={makeItems(3)}
          isSelected={() => false}
          onSelect={vi.fn()}
          close={vi.fn()}
        />
      </JotaiProvider>,
    );
    await flushVirtualizer();

    const input = screen.getByPlaceholderText("CVを検索");
    input.focus();
    await user.keyboard("{ArrowDown}");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(document.activeElement?.textContent).toContain("値0002");

    // 同じ axis・ソート・検索語のまま items の中身だけ変わる（AND追加ボタンによる
    // selectedTags の変化でfacetデータが再取得されるケースを想定。ADR-0013:
    // AND追加は一覧を開いたまま連続で行えるため、ここでスクロール・キーボード位置を
    // 先頭へ戻してはならない）。
    rerender(
      <JotaiProvider store={store}>
        <AxisValueQuickList
          axis="cv"
          axisLabel="CV"
          items={makeItems(3).map((item) => ({ ...item, value: `別${item.value}` }))}
          isSelected={() => false}
          onSelect={vi.fn()}
          close={vi.fn()}
        />
      </JotaiProvider>,
    );
    await flushVirtualizer();
    input.focus();
    await user.keyboard("{ArrowDown}");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // activeIndexRef がリセットされていなければ、直前の位置（先頭=別値0002）から
    // 1つ進んだ別値0001に着地する。リセットされていれば先頭の別値0002に戻ってしまう。
    expect(document.activeElement?.textContent).toContain("別値0001");
    sizeMock.restore();
  });
});

describe("AxisValueQuickList のソート（アイコンボタン＋インライン展開）", () => {
  it("既定では折りたたまれており、アイコンボタンで開閉する", async () => {
    const sizeMock = mockElementSize(260, 260);
    const user = userEvent.setup();
    renderQuickList({ items: makeItems(5) });
    await flushVirtualizer();

    expect(screen.queryByRole("group", { name: "並び替え" })).toBeNull();

    const toggle = screen.getByRole("button", { name: /^並び替え/ });
    await user.click(toggle);
    expect(screen.getByRole("group", { name: "並び替え" })).toBeTruthy();

    await user.click(toggle);
    // collapse variant の退出アニメーション（150ms）が終わるまでマウントされ続ける
    await waitFor(() => expect(screen.queryByRole("group", { name: "並び替え" })).toBeNull());
    sizeMock.restore();
  });

  it("並び替えを選んでもフォーカスは押したソートキーのボタンに残る", async () => {
    const sizeMock = mockElementSize(260, 260);
    const user = userEvent.setup();
    renderQuickList({ items: makeItems(5) });
    await flushVirtualizer();

    await user.click(screen.getByRole("button", { name: /^並び替え/ }));
    await user.click(screen.getByRole("button", { name: "名前" }));
    const nameButton = screen.getByRole("button", { name: "名前（昇順）" });

    expect(document.activeElement).toBe(nameButton);
    sizeMock.restore();
  });

  it("並び替えを選んでもインライン展開は閉じたままにならず、トグルの再クリックで閉じる", async () => {
    const sizeMock = mockElementSize(260, 260);
    const user = userEvent.setup();
    renderQuickList({ items: makeItems(5) });
    await flushVirtualizer();

    const toggle = screen.getByRole("button", { name: /^並び替え/ });
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "名前" }));

    expect(screen.getByRole("group", { name: "並び替え" })).toBeTruthy();

    await user.click(toggle);
    await waitFor(() => expect(screen.queryByRole("group", { name: "並び替え" })).toBeNull());
    sizeMock.restore();
  });

  it("アクティブなキーを再クリックすると昇順/降順が反転し、方向が表示に反映される", async () => {
    const sizeMock = mockElementSize(260, 260);
    const user = userEvent.setup();
    renderQuickList({ items: makeItems(5) });
    await flushVirtualizer();

    await user.click(screen.getByRole("button", { name: /^並び替え/ }));
    const nameButton = screen.getByRole("button", { name: "名前" });
    await user.click(nameButton);
    expect(screen.getByRole("button", { name: "名前（昇順）" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "名前（昇順）" }));
    expect(screen.getByRole("button", { name: "名前（降順）" })).toBeTruthy();
    sizeMock.restore();
  });

  it("ソート変更は axisValueSortAtom へ書き込み、メイン値一覧と共有する", async () => {
    const sizeMock = mockElementSize(260, 260);
    const user = userEvent.setup();
    const { store } = renderQuickList({ items: makeItems(5) });
    await flushVirtualizer();

    await user.click(screen.getByRole("button", { name: /^並び替え/ }));
    await user.click(screen.getByRole("button", { name: "名前" }));

    expect(store.get(axisValueSortAtom)).toEqual({ key: "name", direction: "asc" });
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

  it("選択済みの行には追加ボタンが表示されない（ADR-0013）", async () => {
    const sizeMock = mockElementSize(260, 260);
    const items = makeItems(3);
    const selectedValue = items[0]!.value;
    renderQuickList({ items, onAdd: vi.fn(), isSelected: (value) => value === selectedValue });
    await flushVirtualizer();

    const rows = Array.from(document.querySelectorAll(".mll-qlist__row"));
    expect(rows.length).toBe(3);
    const selectedRow = rows.find((row) => row.textContent?.includes(selectedValue));
    const otherRows = rows.filter((row) => row !== selectedRow);
    expect(selectedRow?.querySelector(".mll-qlist__add")).toBeNull();
    expect(otherRows.length).toBe(2);
    otherRows.forEach((row) => expect(row.querySelector(".mll-qlist__add")).toBeTruthy());
    sizeMock.restore();
  });
});
