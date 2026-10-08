import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FilterChipBand from "../../src/features/library/ui/FilterChipBand";
import { mockApi, type ApiMock } from "../helpers/api";

let api: ApiMock;

beforeEach(() => {
  api = mockApi({ "GET /api/axes/:axis": [] });
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
        onReplace={() => {}}
        onToggle={() => {}}
        onAddTag={() => {}}
        onClearAll={() => {}}
        worksTotal={worksTotal}
        {...overrides}
      />
    </QueryClientProvider>,
  );
}

describe("FilterChipBand のチップクリック", () => {
  it("兄弟値ドロップダウンは既定=置き換えの入口なので、facet 集計を無条件（フィルタ無し）で行う（件数基準を主クリックの結果と一致させる）", async () => {
    renderFilterChipBand();

    await userEvent.click(screen.getByRole("button", { name: "cv/藤田茜" }));

    await waitFor(() => expect(api.requestsTo("GET /api/axes/:axis")).toHaveLength(1));
    const [request] = api.requestsTo("GET /api/axes/:axis");
    expect(request?.params.axis).toBe("cv");
    expect(request?.url.search).toBe("");
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
    renderFilterChipBand(undefined, { valueListItemCount: 12 });
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

  it("valueListItemCount未指定時は従来どおり「＋絞り込み」ボタンを出す（回帰確認）", () => {
    renderFilterChipBand();
    expect(screen.getByRole("button", { name: /絞り込み$/ })).toBeInTheDocument();
  });
});
