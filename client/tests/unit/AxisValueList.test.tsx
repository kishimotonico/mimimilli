import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider, createStore } from "jotai";
import type { AxisFacetItem } from "@mimimilli/shared";
import AxisValueList from "../../src/features/library/ui/AxisValueList";
import { libraryTileSizeAtom, libraryViewModeAtom } from "../../src/features/library/model/atoms";
import { clearResizeObservers, flushAllResizeObservers, mockElementSize } from "./setup";
import { nts } from "../helpers/tag";

afterEach(() => {
  cleanup();
  clearResizeObservers();
});

function makeItem(overrides: Partial<AxisFacetItem> = {}): AxisFacetItem {
  return { value: "藤田茜", count: 5, durationSec: 0, covers: [], ...overrides };
}

function renderAxisValueList(
  props: Partial<React.ComponentProps<typeof AxisValueList>> = {},
  viewMode: "list" | "grid" = "list",
) {
  const store = createStore();
  store.set(libraryViewModeAtom, viewMode);
  const utils = render(
    <JotaiProvider store={store}>
      <AxisValueList
        axis="cv"
        facetItems={[]}
        tagPrefixes={[]}
        selectedTags={[]}
        onReplace={vi.fn()}
        onToggle={vi.fn()}
        onAddTag={vi.fn()}
        {...props}
      />
    </JotaiProvider>,
  );
  return { ...utils, store };
}

async function flushVirtualizer(size = { width: 600, height: 600 }) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    flushAllResizeObservers(size);
  });
}

describe("AxisValueList list 表示（ADR-0012 §5）", () => {
  it("2×2コラージュ・名前・件数・総時間の列を持つ行として並ぶ", async () => {
    const sizeMock = mockElementSize(600, 600);
    renderAxisValueList({
      facetItems: [makeItem({ value: "藤田茜", count: 5, durationSec: 125 })],
    });
    await flushVirtualizer();

    const row = screen.getByRole("option", { name: /藤田茜/ });
    expect(within(row).getByText("藤田茜")).toBeTruthy();
    expect(within(row).getByText("5")).toBeTruthy();
    expect(within(row).getByText("2:05")).toBeTruthy();
    expect(row.querySelector(".mll-collage")).toBeTruthy();
    sizeMock.restore();
  });

  it("件数・総時間は tabular-nums 用のクラスで右揃えになる", async () => {
    const sizeMock = mockElementSize(600, 600);
    renderAxisValueList({ facetItems: [makeItem()] });
    await flushVirtualizer();

    expect(document.querySelector(".mll-vrow__count")).toBeTruthy();
    expect(document.querySelector(".mll-vrow__dur")).toBeTruthy();
    sizeMock.restore();
  });

  it("代表カバーが0件の値はプレースホルダーアイコンで欠けたコラージュを描画する", async () => {
    const sizeMock = mockElementSize(600, 600);
    renderAxisValueList({ facetItems: [makeItem({ covers: [] })] });
    await flushVirtualizer();

    expect(document.querySelector(".mll-collage--empty")).toBeTruthy();
    sizeMock.restore();
  });

  it("代表カバーが1〜3件でもコラージュが崩れず描画される（欠けたセルは背景色）", async () => {
    const sizeMock = mockElementSize(600, 600);
    renderAxisValueList({
      facetItems: [
        makeItem({
          value: "夜想曲",
          covers: [
            { workId: "w1", image: "a.jpg", dimensions: { width: 100, height: 100 } },
            { workId: "w2", image: "b.jpg", dimensions: { width: 100, height: 100 } },
          ],
        }),
      ],
    });
    await flushVirtualizer();

    const collage = document.querySelector(".mll-collage");
    expect(collage).toBeTruthy();
    expect(collage?.querySelectorAll(".mll-collage__cell").length).toBe(4);
    expect(collage?.querySelectorAll("img").length).toBe(2);
    sizeMock.restore();
  });

  it("列見出しクリックでソートが切り替わり、再クリックで昇順降順が反転する", async () => {
    const sizeMock = mockElementSize(600, 600);
    const user = userEvent.setup();
    renderAxisValueList({
      facetItems: [
        makeItem({ value: "b", count: 1 }),
        makeItem({ value: "a", count: 3 }),
        makeItem({ value: "c", count: 2 }),
      ],
    });
    await flushVirtualizer();

    const getOrder = () =>
      Array.from(document.querySelectorAll(".mll-vrow__nm")).map((el) => el.textContent);

    // 既定は件数降順
    expect(getOrder()).toEqual(["a", "c", "b"]);

    await user.click(screen.getByRole("button", { name: /名前/ }));
    await flushVirtualizer();
    expect(getOrder()).toEqual(["a", "b", "c"]);

    await user.click(screen.getByRole("button", { name: /名前/ }));
    await flushVirtualizer();
    expect(getOrder()).toEqual(["c", "b", "a"]);
    sizeMock.restore();
  });

  it("値をクリックすると完全なタグ文字列で onReplace を呼ぶ（既定=置き換え、ADR-0012 §7）", async () => {
    const sizeMock = mockElementSize(600, 600);
    const onReplace = vi.fn();
    const user = userEvent.setup();
    renderAxisValueList({ axis: "cv", facetItems: [makeItem({ value: "藤田茜" })], onReplace });
    await flushVirtualizer();

    const row = screen.getByRole("option", { name: /藤田茜/ });
    await user.click(row.querySelector(".mll-vrow__main") as HTMLElement);
    expect(onReplace).toHaveBeenCalledWith("cv/藤田茜");
    sizeMock.restore();
  });

  it("Ctrl+クリックはAND追加（onToggle）へ反転する（ADR-0012 §7）", async () => {
    const sizeMock = mockElementSize(600, 600);
    const onToggle = vi.fn();
    const onReplace = vi.fn();
    renderAxisValueList({
      axis: "cv",
      facetItems: [makeItem({ value: "藤田茜" })],
      onToggle,
      onReplace,
    });
    await flushVirtualizer();

    const row = screen.getByRole("option", { name: /藤田茜/ });
    fireEvent.click(row.querySelector(".mll-vrow__main") as HTMLElement, { ctrlKey: true });
    expect(onToggle).toHaveBeenCalledWith("cv/藤田茜");
    expect(onReplace).not.toHaveBeenCalled();
    sizeMock.restore();
  });

  it("ホバー時の＋ボタンは冪等なAND追加（onAddTag）を呼ぶ", async () => {
    const sizeMock = mockElementSize(600, 600);
    const onAddTag = vi.fn();
    const user = userEvent.setup();
    renderAxisValueList({ axis: "cv", facetItems: [makeItem({ value: "藤田茜" })], onAddTag });
    await flushVirtualizer();

    const row = screen.getByRole("option", { name: /藤田茜/ });
    await user.click(row.querySelector(".mll-vrow__add") as HTMLElement);
    expect(onAddTag).toHaveBeenCalledWith("cv/藤田茜");
    sizeMock.restore();
  });

  it("選択済みの行には追加ボタンが表示されない（ADR-0013）", async () => {
    const sizeMock = mockElementSize(600, 600);
    renderAxisValueList({
      axis: "cv",
      facetItems: [makeItem({ value: "藤田茜" })],
      selectedTags: nts(["cv/藤田茜"]),
    });
    await flushVirtualizer();

    const row = screen.getByRole("option", { name: /藤田茜/ });
    expect(row.querySelector(".mll-vrow__add")).toBeNull();
    sizeMock.restore();
  });

  it("1000件でも仮想化により描画されるボタンは総数よりずっと少ない", async () => {
    const sizeMock = mockElementSize(600, 600);
    const items = Array.from({ length: 1000 }, (_, i) => makeItem({ value: `値${i}`, count: i }));
    renderAxisValueList({ facetItems: items });
    await flushVirtualizer();

    const rows = document.querySelectorAll(".mll-vrow");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(100);
    sizeMock.restore();
  });
});

describe("AxisValueList grid 表示", () => {
  it("代表カバー2×2コラージュ・名前・件数バッジのタイルとして並ぶ", async () => {
    const sizeMock = mockElementSize(600, 600);
    renderAxisValueList({ facetItems: [makeItem({ value: "藤田茜", count: 5 })] }, "grid");
    await flushVirtualizer();

    const tile = screen.getByRole("option", { name: /藤田茜/ });
    expect(within(tile).getByText("藤田茜")).toBeTruthy();
    expect(within(tile).getByText("5 件")).toBeTruthy();
    expect(tile.querySelector(".mll-collage")).toBeTruthy();
    sizeMock.restore();
  });

  it("タイルサイズ設定（libraryTileSizeAtom）がCSS変数に反映される", async () => {
    const sizeMock = mockElementSize(600, 600);
    const store = createStore();
    store.set(libraryViewModeAtom, "grid");
    store.set(libraryTileSizeAtom, 200);
    render(
      <JotaiProvider store={store}>
        <AxisValueList
          axis="cv"
          facetItems={[makeItem()]}
          tagPrefixes={[]}
          selectedTags={[]}
          onReplace={vi.fn()}
          onToggle={vi.fn()}
          onAddTag={vi.fn()}
        />
      </JotaiProvider>,
    );
    await flushVirtualizer();

    const grid = document.querySelector(".mll-grid") as HTMLElement | null;
    expect(grid?.style.getPropertyValue("--tile-size")).toBe("200px");
    sizeMock.restore();
  });
});

describe("AxisValueList コンテキスト検索（ADR-0012 §6）", () => {
  it("表示中の値だけを絞り込み、全体検索state（URL）には影響しない", async () => {
    const sizeMock = mockElementSize(600, 600);
    const user = userEvent.setup();
    renderAxisValueList({
      facetItems: [makeItem({ value: "藤田茜" }), makeItem({ value: "夜想曲サークル" })],
    });
    await flushVirtualizer();

    expect(screen.getByRole("option", { name: /藤田茜/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /夜想曲サークル/ })).toBeTruthy();

    const input = screen.getByPlaceholderText("値を絞り込み");
    await user.type(input, "藤田");
    await flushVirtualizer();

    expect(screen.getByRole("option", { name: /藤田茜/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /夜想曲サークル/ })).toBeNull();
    sizeMock.restore();
  });

  it("軸切り替え（axisプロパティ変更）でリセットされる", async () => {
    const sizeMock = mockElementSize(600, 600);
    const user = userEvent.setup();
    const store = createStore();
    store.set(libraryViewModeAtom, "list");
    const { rerender } = render(
      <JotaiProvider store={store}>
        <AxisValueList
          axis="cv"
          facetItems={[makeItem({ value: "藤田茜" })]}
          tagPrefixes={[]}
          selectedTags={[]}
          onReplace={vi.fn()}
          onToggle={vi.fn()}
          onAddTag={vi.fn()}
        />
      </JotaiProvider>,
    );
    await flushVirtualizer();

    const input = screen.getByPlaceholderText("値を絞り込み") as HTMLInputElement;
    await user.type(input, "藤田");
    expect(input.value).toBe("藤田");

    rerender(
      <JotaiProvider store={store}>
        <AxisValueList
          axis="circle"
          facetItems={[makeItem({ value: "夜想曲" })]}
          tagPrefixes={[]}
          selectedTags={[]}
          onReplace={vi.fn()}
          onToggle={vi.fn()}
          onAddTag={vi.fn()}
        />
      </JotaiProvider>,
    );
    await flushVirtualizer();

    const inputAfter = screen.getByPlaceholderText("値を絞り込み") as HTMLInputElement;
    expect(inputAfter.value).toBe("");
    sizeMock.restore();
  });
});

describe("AxisValueList エラー・空状態の再試行導線", () => {
  it("isFacetError で再試行ボタンをクリックすると onRetryFacets を呼ぶ", async () => {
    const onRetryFacets = vi.fn();
    const user = userEvent.setup();
    renderAxisValueList({
      isFacetError: true,
      facetItems: [makeItem({ value: "tag-a" })],
      onRetryFacets,
    });

    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetryFacets).toHaveBeenCalledTimes(1);
  });

  it("キャッシュが無い（facetItems空）isFacetErrorは一覧全体をエラー画面に置き換える", () => {
    renderAxisValueList({ axis: "circle", isFacetError: true, facetItems: [] });
    expect(screen.getByText("読み込みに失敗しました")).toBeTruthy();
  });
});

describe("AxisValueList の件数表示", () => {
  it("isFacetLoading のときはファセット件数を描画しない", () => {
    renderAxisValueList({ facetItems: [makeItem()], isFacetLoading: true });
    expect(document.querySelector(".mle-col__hd .count")).toBeNull();
  });
});
