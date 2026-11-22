import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FilterChipBand from "../../src/features/library/ui/FilterChipBand";
import { mockApi, type ApiMock } from "../helpers/api";

let api: ApiMock;

beforeEach(() => {
  api = mockApi({ "POST /api/smart-folders/:id/groups": [] });
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
        facetScope={{ folderId: "fav", group: null, tags: ["cv/藤田茜"], q: "雨" }}
        onAddTag={() => {}}
        onRemoveTag={() => {}}
        onClearAll={() => {}}
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
    await userEvent.click(screen.getByText("cv/藤田茜"));

    expect(api.requestsTo("POST /api/smart-folders/:id/groups")).toHaveLength(0);
  });

  it("×で個別解除し、すべてクリアで全解除する", async () => {
    const onRemoveTag = vi.fn();
    const onClearAll = vi.fn();
    renderFilterChipBand(undefined, { onRemoveTag, onClearAll });

    await userEvent.click(screen.getByRole("button", { name: "cv/藤田茜を解除" }));
    expect(onRemoveTag).toHaveBeenCalledWith("cv/藤田茜");

    await userEvent.click(screen.getByRole("button", { name: "すべてクリア" }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("「＋絞り込み」の候補は開いている一覧の条件・チップ・検索語を母集団にして POST /:id/groups で取る", async () => {
    renderFilterChipBand();

    await userEvent.click(screen.getByRole("button", { name: /絞り込み$/ }));
    await userEvent.click(screen.getByRole("button", { name: "タグ" }));

    await waitFor(() =>
      expect(api.requestsTo("POST /api/smart-folders/:id/groups")).toHaveLength(1),
    );
    const [request] = api.requestsTo("POST /api/smart-folders/:id/groups");
    expect(request?.params.id).toBe("fav");
    expect(request?.body).toEqual({ groupBy: { kind: "tag" }, tags: ["cv/藤田茜"], q: "雨" });
  });

  it("「＋絞り込み」の軸は定義済みの prefix 全部・タグ・追加日", async () => {
    renderFilterChipBand(undefined, {
      tagPrefixes: [
        { prefix: "cv", label: "CV", color: "cv", protected: true, displayPriority: 0 } as never,
      ],
    });

    await userEvent.click(screen.getByRole("button", { name: /絞り込み$/ }));
    const axes = screen
      .getAllByRole("button")
      .filter((b) => b.className.includes("mll-qlist__item"));
    expect(axes.map((b) => b.textContent)).toEqual(["CV", "タグ", "追加日"]);
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

describe("値一覧ペイン表示中の件数ラベルと＋絞り込みの扱い（ADR-0026）", () => {
  it("valueListItemCount指定時は絞り込み後件数の代わりにライブラリ全体である旨のラベルを出す", () => {
    renderFilterChipBand(undefined, { valueListItemCount: 12, facetScope: undefined });
    expect(screen.getByText("12分類（件数はライブラリ全体）")).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ 件$/)).toBeNull();
  });

  it("valueListItemCount指定時は worksTotal が渡っても絞り込み後件数を出さない", () => {
    renderFilterChipBand(120, { valueListItemCount: 12 });
    expect(screen.queryByText("120 件")).toBeNull();
    expect(screen.getByText("12分類（件数はライブラリ全体）")).toBeInTheDocument();
  });

  it("valueListItemCount指定時は「＋絞り込み」ボタンを出さない（値一覧はAND追加を提供しない）", () => {
    renderFilterChipBand(undefined, { valueListItemCount: 12 });
    expect(screen.queryByRole("button", { name: /絞り込み$/ })).toBeNull();
  });

  it("valueListItemCount未指定時は「＋絞り込み」ボタンを出す（回帰確認）", () => {
    renderFilterChipBand();
    expect(screen.getByRole("button", { name: /絞り込み$/ })).toBeInTheDocument();
  });
});
