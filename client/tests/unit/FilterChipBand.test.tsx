import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FilterChipBand from "../../src/features/library/ui/FilterChipBand";
import { getAxisFacets } from "../../src/features/library/api";

afterEach(cleanup);

vi.mock("../../src/features/library/api", () => ({
  getAxisFacets: vi.fn(() => Promise.resolve([])),
}));

function renderFilterChipBand() {
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
      />
    </QueryClientProvider>,
  );
}

describe("FilterChipBand のチップクリック", () => {
  it("兄弟値ドロップダウンの facet 集計に、自分のタグを除く現在選択中の全タグを渡す（他軸フィルタの引き継ぎ）", async () => {
    renderFilterChipBand();

    await userEvent.click(screen.getByRole("button", { name: "cv/藤田茜" }));

    await waitFor(() => {
      expect(getAxisFacets).toHaveBeenCalledWith("cv", {
        tags: ["サークル/月白製作所"],
        tagOp: "AND",
      });
    });
  });
});
