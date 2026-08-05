import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterChipBand from "../../src/features/library/ui/FilterChipBand";

afterEach(cleanup);

// AxisValuePopoverPanel（チップの兄弟値ドロップダウン）に渡される selectedTags を
// 検証するため、実体をモックして受け取った props を記録する。
vi.mock("../../src/features/library/ui/AxisValuePopoverPanel", () => ({
  default: vi.fn((props: { selectedTags: string[] }) => (
    <div data-testid="popover-selected-tags">{props.selectedTags.join(",")}</div>
  )),
}));

describe("FilterChipBand のチップクリック", () => {
  it("兄弟値ドロップダウンに、自分のタグだけでなく現在選択中の全タグを渡す（他軸フィルタの引き継ぎ）", async () => {
    render(
      <FilterChipBand
        tagPrefixes={[]}
        selectedTags={["cv/藤田茜", "サークル/月白製作所"]}
        onReplace={() => {}}
        onToggle={() => {}}
        onClearAll={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "cv/藤田茜" }));

    expect(screen.getByTestId("popover-selected-tags")).toHaveTextContent(
      "cv/藤田茜,サークル/月白製作所",
    );
  });
});
