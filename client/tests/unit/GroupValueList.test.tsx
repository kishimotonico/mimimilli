import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider as JotaiProvider, createStore } from "jotai";
import type { GroupBy, GroupValueItem } from "@mimimilli/shared";
import GroupValueList from "../../src/features/library/ui/GroupValueList";
import { libraryTileSizeAtom, libraryViewModeAtom } from "../../src/features/library/model/atoms";
import { clearResizeObservers, flushAllResizeObservers, mockElementSize } from "./setup";

const CV: GroupBy = { kind: "prefix", prefix: "cv" };
const CIRCLE: GroupBy = { kind: "prefix", prefix: "circle" };

afterEach(() => {
  cleanup();
  clearResizeObservers();
});

function makeItem(overrides: Partial<GroupValueItem> = {}): GroupValueItem {
  return { value: "藤田茜", count: 5, durationSec: 0, covers: [], ...overrides };
}

function renderGroupValueList(
  props: Partial<React.ComponentProps<typeof GroupValueList>> = {},
  viewMode: "list" | "grid" = "list",
) {
  const store = createStore();
  store.set(libraryViewModeAtom, viewMode);
  const utils = render(
    <JotaiProvider store={store}>
      <GroupValueList
        groupBy={CV}
        sort="count-desc"
        onSortChange={vi.fn()}
        groupValueItems={[]}
        tagPrefixes={[]}
        onSelectValue={vi.fn()}
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

function queryRow(className: string, text: string): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>(className)).find((el) =>
      el.textContent?.includes(text),
    ) ?? null
  );
}

function getRow(className: string, text: string): HTMLElement {
  const row = queryRow(className, text);
  if (!row) throw new Error(`row not found: ${className} ${text}`);
  return row;
}

describe("GroupValueList list 表示（ADR-0012 §5）", () => {
  it("2×2コラージュ・名前・件数・総時間の列を持つ行として並ぶ", async () => {
    const sizeMock = mockElementSize(600, 600);
    renderGroupValueList({
      groupValueItems: [makeItem({ value: "藤田茜", count: 5, durationSec: 125 })],
    });
    await flushVirtualizer();

    const row = getRow(".mll-vrow", "藤田茜");
    expect(within(row).getByText("藤田茜")).toBeInTheDocument();
    expect(within(row).getByText("5")).toBeInTheDocument();
    expect(within(row).getByText("2:05")).toBeInTheDocument();
    expect(row.querySelector(".mll-collage")).toBeInTheDocument();
    sizeMock.restore();
  });

  it("件数・総時間は tabular-nums 用のクラスで右揃えになる", async () => {
    const sizeMock = mockElementSize(600, 600);
    renderGroupValueList({ groupValueItems: [makeItem()] });
    await flushVirtualizer();

    expect(document.querySelector(".mll-vrow__count")).toBeInTheDocument();
    expect(document.querySelector(".mll-vrow__dur")).toBeInTheDocument();
    sizeMock.restore();
  });

  it("代表カバーが0件の値はプレースホルダーアイコンで欠けたコラージュを描画する", async () => {
    const sizeMock = mockElementSize(600, 600);
    renderGroupValueList({ groupValueItems: [makeItem({ covers: [] })] });
    await flushVirtualizer();

    expect(document.querySelector(".mll-collage--empty")).toBeInTheDocument();
    sizeMock.restore();
  });

  it("代表カバーが1〜3件でもコラージュが崩れず描画される（欠けたセルは背景色）", async () => {
    const sizeMock = mockElementSize(600, 600);
    renderGroupValueList({
      groupValueItems: [
        makeItem({
          value: "夜想曲",
          covers: [
            {
              workId: "w1",
              image: "a.jpg",
              dimensions: { width: 100, height: 100 },
              version: "v1",
            },
            {
              workId: "w2",
              image: "b.jpg",
              dimensions: { width: 100, height: 100 },
              version: "v2",
            },
          ],
        }),
      ],
    });
    await flushVirtualizer();

    const collage = document.querySelector(".mll-collage");
    expect(collage).toBeInTheDocument();
    expect(collage?.querySelectorAll(".mll-collage__cell").length).toBe(4);
    expect(collage?.querySelectorAll("img").length).toBe(2);
    sizeMock.restore();
  });

  it("列見出しクリックは切り替え後の並びを onSortChange へ渡す（件数降順なら、件数は反転・名前は昇順）", async () => {
    const sizeMock = mockElementSize(600, 600);
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderGroupValueList({ groupValueItems: [makeItem({ value: "a" })], onSortChange });
    await flushVirtualizer();

    await user.click(screen.getByRole("button", { name: /名前/ }));
    expect(onSortChange).toHaveBeenLastCalledWith("name-asc");

    await user.click(screen.getByRole("button", { name: /件数/ }));
    expect(onSortChange).toHaveBeenLastCalledWith("count-asc");

    await user.click(screen.getByRole("button", { name: /総時間/ }));
    expect(onSortChange).toHaveBeenLastCalledWith("duration-desc");
    sizeMock.restore();
  });

  it("並びを変えて取得中になっても、押した列見出しはそのまま残りフォーカスを保つ", async () => {
    const sizeMock = mockElementSize(600, 600);
    const user = userEvent.setup();
    const store = createStore();
    store.set(libraryViewModeAtom, "list");
    const element = (isLoading: boolean) => (
      <JotaiProvider store={store}>
        <GroupValueList
          groupBy={CV}
          sort="count-desc"
          onSortChange={vi.fn()}
          groupValueItems={isLoading ? [] : [makeItem({ value: "a" })]}
          isGroupValuesLoading={isLoading}
          tagPrefixes={[]}
          onSelectValue={vi.fn()}
        />
      </JotaiProvider>
    );
    const { rerender } = render(element(false));
    await flushVirtualizer();

    const header = screen.getByRole("button", { name: /件数/ });
    await user.click(header);
    expect(document.activeElement).toBe(header);

    rerender(element(true));
    expect(screen.getByRole("button", { name: /件数/ })).toBe(header);
    expect(document.activeElement).toBe(header);
    sizeMock.restore();
  });

  it("通知は列見出しより上に出し、値の絞り込みが0件のときは列見出しを出さない", async () => {
    const sizeMock = mockElementSize(600, 600);
    const user = userEvent.setup();
    renderGroupValueList({
      groupValueItems: [makeItem({ value: "a" })],
      isGroupValuesError: true,
    });
    await flushVirtualizer();

    const notice = document.querySelector(".mle-col__notice")!;
    const header = document.querySelector(".mll-vlist-hd")!;
    expect(notice.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.type(screen.getByPlaceholderText("cvを絞り込み"), "zzz");
    expect(screen.getByText("該当するcvがありません")).toBeInTheDocument();
    expect(document.querySelector(".mll-vlist-hd")).toBeNull();
    sizeMock.restore();
  });

  it("行はサーバーが返した順のまま並ぶ", async () => {
    const sizeMock = mockElementSize(600, 600);
    renderGroupValueList({
      sort: "name-desc",
      groupValueItems: [
        makeItem({ value: "c" }),
        makeItem({ value: "a" }),
        makeItem({ value: "b" }),
      ],
    });
    await flushVirtualizer();

    expect(
      Array.from(document.querySelectorAll(".mll-vrow__nm")).map((el) => el.textContent),
    ).toEqual(["c", "a", "b"]);
    sizeMock.restore();
  });

  it("値をクリックするとその値で onSelectValue を呼ぶ（ADR-0041）", async () => {
    const sizeMock = mockElementSize(600, 600);
    const onSelectValue = vi.fn();
    const user = userEvent.setup();
    renderGroupValueList({
      groupBy: CV,
      groupValueItems: [makeItem({ value: "藤田茜" })],
      onSelectValue,
    });
    await flushVirtualizer();

    const row = getRow(".mll-vrow", "藤田茜");
    await user.click(row.querySelector(".mll-vrow__main") as HTMLElement);
    expect(onSelectValue).toHaveBeenCalledWith("藤田茜");
    sizeMock.restore();
  });

  it("Ctrl+クリックでも主クリックと同じくその値の作品一覧へ進む（反転しない。ADR-0041）", async () => {
    const sizeMock = mockElementSize(600, 600);
    const onSelectValue = vi.fn();
    renderGroupValueList({
      groupBy: CV,
      groupValueItems: [makeItem({ value: "藤田茜" })],
      onSelectValue,
    });
    await flushVirtualizer();

    const row = getRow(".mll-vrow", "藤田茜");
    fireEvent.click(row.querySelector(".mll-vrow__main") as HTMLElement, { ctrlKey: true });
    expect(onSelectValue).toHaveBeenCalledTimes(1);
    expect(onSelectValue).toHaveBeenCalledWith("藤田茜");
    sizeMock.restore();
  });

  it("値一覧の行にはAND追加ボタンが無い（チップは「＋絞り込み」から足す）", async () => {
    const sizeMock = mockElementSize(600, 600);
    renderGroupValueList({ groupBy: CV, groupValueItems: [makeItem({ value: "藤田茜" })] });
    await flushVirtualizer();

    const row = getRow(".mll-vrow", "藤田茜");
    expect(within(row).queryByRole("button", { name: /AND追加/ })).toBeNull();
    sizeMock.restore();
  });

  it("0件のとき、絞り込みの案内があればその文言と操作を出し、無ければ既定の文言を出す", () => {
    const { unmount } = renderGroupValueList({ groupValueItems: [] });
    expect(screen.getByText("cvがありません")).toBeInTheDocument();
    unmount();

    renderGroupValueList({
      groupValueItems: [],
      emptyState: {
        message: "選択中のフィルタに一致する作品はありません",
        action: <button type="button">「すべて」で探す</button>,
      },
    });
    expect(screen.getByText("選択中のフィルタに一致する作品はありません")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "「すべて」で探す" })).toBeInTheDocument();
  });

  it("1000件でも仮想化により描画されるボタンは総数よりずっと少ない", async () => {
    const sizeMock = mockElementSize(600, 600);
    const items = Array.from({ length: 1000 }, (_, i) => makeItem({ value: `値${i}`, count: i }));
    renderGroupValueList({ groupValueItems: items });
    await flushVirtualizer();

    const rows = document.querySelectorAll(".mll-vrow");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(100);
    sizeMock.restore();
  });
});

describe("GroupValueList list 表示の矢印キー・roving tabindex", () => {
  it("ArrowDownで次の行へ、Home/Endで先頭・末尾へ移動する（作品一覧と同じ規則）", async () => {
    const sizeMock = mockElementSize(600, 600);
    const user = userEvent.setup();
    renderGroupValueList({
      groupValueItems: [
        makeItem({ value: "a", count: 3 }),
        makeItem({ value: "b", count: 2 }),
        makeItem({ value: "c", count: 1 }),
      ],
    });
    await flushVirtualizer();

    const first = getRow(".mll-vrow", "a").querySelector(".mll-vrow__main") as HTMLElement;
    first.focus();
    expect(document.activeElement).toBe(first);

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement?.closest(".mll-vrow")?.textContent).toContain("b");

    await user.keyboard("{End}");
    expect(document.activeElement?.closest(".mll-vrow")?.textContent).toContain("c");

    await user.keyboard("{Home}");
    expect(document.activeElement?.closest(".mll-vrow")?.textContent).toContain("a");

    // 端でのArrowUpはラップアラウンドせずクランプする（作品一覧と同じ規則）。
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement?.closest(".mll-vrow")?.textContent).toContain("a");
    sizeMock.restore();
  });

  it("roving tabindex: 現在位置の行だけがtabIndex 0になる", async () => {
    const sizeMock = mockElementSize(600, 600);
    const user = userEvent.setup();
    renderGroupValueList({
      groupValueItems: [
        makeItem({ value: "a" }),
        makeItem({ value: "b" }),
        makeItem({ value: "c" }),
      ],
    });
    await flushVirtualizer();

    const first = getRow(".mll-vrow", "a").querySelector(".mll-vrow__main") as HTMLElement;
    first.focus();
    await user.keyboard("{ArrowDown}");

    const mains = Array.from(document.querySelectorAll<HTMLButtonElement>(".mll-vrow__main"));
    const tabbable = mains.filter((el) => el.tabIndex === 0);
    expect(tabbable.length).toBe(1);
    expect(tabbable[0]).toBe(document.activeElement);
    sizeMock.restore();
  });
});

describe("GroupValueList grid 表示", () => {
  it("代表カバー2×2コラージュ・名前・件数バッジのタイルとして並ぶ", async () => {
    const sizeMock = mockElementSize(600, 600);
    renderGroupValueList({ groupValueItems: [makeItem({ value: "藤田茜", count: 5 })] }, "grid");
    await flushVirtualizer();

    const tile = getRow(".mll-vtile", "藤田茜");
    expect(within(tile).getByText("藤田茜")).toBeInTheDocument();
    expect(within(tile).getByText("5 件")).toBeInTheDocument();
    expect(tile.querySelector(".mll-collage")).toBeInTheDocument();
    sizeMock.restore();
  });

  it("タイルサイズ設定（libraryTileSizeAtom）がCSS変数に反映される", async () => {
    const sizeMock = mockElementSize(600, 600);
    const store = createStore();
    store.set(libraryViewModeAtom, "grid");
    store.set(libraryTileSizeAtom, 200);
    render(
      <JotaiProvider store={store}>
        <GroupValueList
          groupBy={CV}
          groupValueItems={[makeItem()]}
          tagPrefixes={[]}
          onSelectValue={vi.fn()}
        />
      </JotaiProvider>,
    );
    await flushVirtualizer();

    const grid = document.querySelector(".mll-grid") as HTMLElement | null;
    expect(grid?.style.getPropertyValue("--tile-size")).toBe("200px");
    sizeMock.restore();
  });
});

describe("GroupValueList grid 表示の矢印キー・roving tabindex", () => {
  it("Home/Endで先頭・末尾のタイルへ移動し、現在位置だけがtabIndex 0になる", async () => {
    const sizeMock = mockElementSize(600, 600);
    const user = userEvent.setup();
    const items = Array.from({ length: 8 }, (_, i) => makeItem({ value: `値${i}`, count: i }));
    renderGroupValueList({ groupValueItems: items }, "grid");
    await flushVirtualizer();

    const tiles = () =>
      Array.from(document.querySelectorAll<HTMLButtonElement>(".mll-vtile__main"));
    const first = tiles()[0]!;
    first.focus();
    expect(document.activeElement).toBe(first);

    await user.keyboard("{End}");
    expect(document.activeElement).toBe(tiles().at(-1));

    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(tiles()[0]);

    const tabbable = tiles().filter((el) => el.tabIndex === 0);
    expect(tabbable.length).toBe(1);
    expect(tabbable[0]).toBe(document.activeElement);
    sizeMock.restore();
  });
});

describe("GroupValueList コンテキスト検索（ADR-0012 §6）", () => {
  it("表示中の値だけを絞り込み、全体検索state（URL）には影響しない", async () => {
    const sizeMock = mockElementSize(600, 600);
    const user = userEvent.setup();
    renderGroupValueList({
      groupValueItems: [makeItem({ value: "藤田茜" }), makeItem({ value: "夜想曲サークル" })],
    });
    await flushVirtualizer();

    expect(getRow(".mll-vrow", "藤田茜")).toBeInTheDocument();
    expect(getRow(".mll-vrow", "夜想曲サークル")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("cvを絞り込み");
    await user.type(input, "藤田");
    await flushVirtualizer();

    expect(getRow(".mll-vrow", "藤田茜")).toBeInTheDocument();
    expect(queryRow(".mll-vrow", "夜想曲サークル")).toBeNull();
    sizeMock.restore();
  });

  it("グループ分けの切り替え（groupBy プロパティ変更）でリセットされる", async () => {
    const sizeMock = mockElementSize(600, 600);
    const user = userEvent.setup();
    const store = createStore();
    store.set(libraryViewModeAtom, "list");
    const { rerender } = render(
      <JotaiProvider store={store}>
        <GroupValueList
          groupBy={CV}
          sort="count-desc"
          onSortChange={vi.fn()}
          groupValueItems={[makeItem({ value: "藤田茜" })]}
          tagPrefixes={[]}
          onSelectValue={vi.fn()}
        />
      </JotaiProvider>,
    );
    await flushVirtualizer();

    const input = screen.getByPlaceholderText("cvを絞り込み") as HTMLInputElement;
    await user.type(input, "藤田");
    expect(input.value).toBe("藤田");

    rerender(
      <JotaiProvider store={store}>
        <GroupValueList
          groupBy={CIRCLE}
          sort="count-desc"
          onSortChange={vi.fn()}
          groupValueItems={[makeItem({ value: "夜想曲" })]}
          tagPrefixes={[]}
          onSelectValue={vi.fn()}
        />
      </JotaiProvider>,
    );
    await flushVirtualizer();

    const inputAfter = screen.getByPlaceholderText("circleを絞り込み") as HTMLInputElement;
    expect(inputAfter.value).toBe("");
    sizeMock.restore();
  });
});

describe("GroupValueList エラー・空状態の再試行導線", () => {
  it("isGroupValuesError で再試行ボタンをクリックすると onRetryGroupValues を呼ぶ", async () => {
    const onRetryGroupValues = vi.fn();
    const user = userEvent.setup();
    renderGroupValueList({
      isGroupValuesError: true,
      groupValueItems: [makeItem({ value: "tag-a" })],
      onRetryGroupValues,
    });

    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetryGroupValues).toHaveBeenCalledTimes(1);
  });

  it("キャッシュが無い（groupValueItems空）isGroupValuesErrorは一覧全体をエラー画面に置き換える", () => {
    renderGroupValueList({ groupBy: CIRCLE, isGroupValuesError: true, groupValueItems: [] });
    expect(screen.getByText("読み込みに失敗しました")).toBeInTheDocument();
  });
});
