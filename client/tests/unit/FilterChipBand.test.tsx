import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterChipBand from "../../src/features/library/ui/FilterChipBand";

afterEach(cleanup);

// AxisValuePopoverPanel（チップの兄弟値ドロップダウン）に渡される selectedTags を
// 検証するため、実体をモックして受け取った props を記録する。呼び出し側は退出
// アニメーション対応のため isOpen=false でも常にマウントするので、モック側で
// isOpen を見て描画を切り替える（実体の Presence の代わり）。
vi.mock("../../src/features/library/ui/AxisValuePopoverPanel", () => ({
  default: vi.fn((props: { selectedTags: string[]; isOpen: boolean }) =>
    props.isOpen ? (
      <div data-testid="popover-selected-tags">{props.selectedTags.join(",")}</div>
    ) : null,
  ),
}));

describe("FilterChipBand のチップクリック", () => {
  it("兄弟値ドロップダウンに、自分のタグだけでなく現在選択中の全タグを渡す（他軸フィルタの引き継ぎ）", async () => {
    render(
      <FilterChipBand
        tagPrefixes={[]}
        selectedTags={["cv/藤田茜", "サークル/月白製作所"]}
        onReplace={() => {}}
        onToggle={() => {}}
        onAddTag={() => {}}
        onClearAll={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "cv/藤田茜" }));

    expect(screen.getByTestId("popover-selected-tags")).toHaveTextContent(
      "cv/藤田茜,サークル/月白製作所",
    );
  });
});
