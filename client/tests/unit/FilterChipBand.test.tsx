import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FilterChipBand from "../../src/features/library/ui/FilterChipBand";
import { groupsQueryOf, mockApi, type ApiMock } from "../helpers/api";

let api: ApiMock;

beforeEach(() => {
  api = mockApi({ "GET /api/smart-folders/:id/groups": [] });
});

afterEach(cleanup);

function renderFilterChipBand(
  worksTotal?: number,
  overrides: Partial<React.ComponentProps<typeof FilterChipBand>> = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FilterChipBand
        tagPrefixes={[]}
        selectedTags={["cv/藤田茜", "サークル/月白製作所"]}
        groupValueScope={{ folderId: "fav", group: null, tags: ["cv/藤田茜"], q: "雨" }}
        onAddTag={() => {}}
        onRemoveTag={() => {}}
        worksTotal={worksTotal}
        {...overrides}
      />
    </QueryClientProvider>,
  );
}

describe("FilterChipBand のチップ", () => {
  it("チップ本体のクリックでは兄弟値ドロップダウンを開かない（ADR-0041）", async () => {
    renderFilterChipBand();

    expect(screen.queryByRole("button", { name: "cv/藤田茜" })).toBeNull();
    await userEvent.click(screen.getByText("藤田茜"));

    expect(api.requestsTo("GET /api/smart-folders/:id/groups")).toHaveLength(0);
  });

  it("×で個別解除でき、AND ラベルと「すべてクリア」は無い", async () => {
    const onRemoveTag = vi.fn();
    renderFilterChipBand(undefined, { onRemoveTag });

    await userEvent.click(screen.getByRole("button", { name: "cv/藤田茜を解除" }));
    expect(onRemoveTag).toHaveBeenCalledWith("cv/藤田茜");

    expect(screen.queryByRole("button", { name: "すべてクリア" })).toBeNull();
    expect(screen.queryByText("AND")).toBeNull();
  });

  it("「＋絞り込み」の候補は開いている一覧の条件・チップ・検索語を母集団にして GET /:id/groups で取る", async () => {
    renderFilterChipBand();

    await userEvent.click(screen.getByRole("button", { name: /絞り込み$/ }));
    await userEvent.click(screen.getByRole("button", { name: "タグ" }));

    await waitFor(() =>
      expect(api.requestsTo("GET /api/smart-folders/:id/groups")).toHaveLength(1),
    );
    const [request] = api.requestsTo("GET /api/smart-folders/:id/groups");
    expect(request?.params.id).toBe("fav");
    expect(request && groupsQueryOf(request)).toEqual({
      groupBy: "tag",
      groupSort: "count-desc",
      tags: ["cv/藤田茜"],
      q: "雨",
    });
  });

  it("「＋絞り込み」のグループ分けは定義済みの prefix 全部・タグ・追加年", async () => {
    renderFilterChipBand(undefined, {
      tagPrefixes: [
        { prefix: "cv", label: "CV", color: "cv", protected: true, displayPriority: 0 } as never,
      ],
    });

    await userEvent.click(screen.getByRole("button", { name: /絞り込み$/ }));
    const picker = screen.getByRole("group", { name: "絞り込みの種類" });
    const groupByButtons = within(picker).getAllByRole("button");
    expect(groupByButtons.map((b) => b.textContent)).toEqual(["CV", "タグ", "追加年"]);
  });

  it("段を切り替えても同じポップオーバーを保ち、Esc で選んだ項目へ戻る", async () => {
    const user = userEvent.setup();
    renderFilterChipBand();
    const trigger = screen.getByRole("button", { name: "絞り込み" });
    await user.click(trigger);
    const popup = screen.getByRole("dialog");
    const picker = within(popup).getByRole("group", { name: "絞り込みの種類" });
    const [first] = within(picker).getAllByRole("button");
    await waitFor(() => expect(first).toHaveFocus());

    await user.click(within(picker).getByRole("button", { name: "追加年" }));
    expect(screen.getByRole("dialog")).toBe(popup);
    expect(within(popup).getByRole("textbox", { name: "追加年を検索" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBe(popup);
    expect(within(popup).getByRole("button", { name: "追加年" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("FilterChipBand の件数表示", () => {
  it("worksTotal が未確定のときは件数テキストを描画しない", () => {
    renderFilterChipBand();
    expect(screen.queryByText(/件$/)).toBeNull();
  });

  it("worksTotal が渡されたとき、絞り込み後件数を表示する", () => {
    renderFilterChipBand(120);
    expect(screen.getByText("120 件")).toBeInTheDocument();
  });
});

describe("値一覧ペイン表示中の件数ラベルと＋絞り込みの扱い（ADR-0041）", () => {
  it("valueList指定時は絞り込み後件数の代わりにグループ分けの名前と件数を出す", () => {
    renderFilterChipBand(undefined, {
      valueList: { label: "CV", count: 12 },
      groupValueScope: undefined,
    });
    expect(screen.getByText("CV 12 件")).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ 件$/)).toBeNull();
  });

  it("valueList指定時は worksTotal が渡っても絞り込み後件数を出さない", () => {
    renderFilterChipBand(120, { valueList: { label: "CV", count: 12 } });
    expect(screen.queryByText("120 件")).toBeNull();
    expect(screen.getByText("CV 12 件")).toBeInTheDocument();
  });

  it("valueList指定時も「＋絞り込み」ボタンを出す（値一覧でもチップを足せる）", () => {
    renderFilterChipBand(undefined, { valueList: { label: "CV", count: 12 } });
    expect(screen.getByRole("button", { name: /絞り込み$/ })).toBeInTheDocument();
  });

  it("valueList未指定時は「＋絞り込み」ボタンを出す（回帰確認）", () => {
    renderFilterChipBand();
    expect(screen.getByRole("button", { name: /絞り込み$/ })).toBeInTheDocument();
  });
});
