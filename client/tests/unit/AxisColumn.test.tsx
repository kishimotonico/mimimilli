import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TagPrefix } from "@mimimilli/shared";
import AxisColumn from "../../src/features/library/ui/AxisColumn";

afterEach(cleanup);

const PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: "cv", showAsAxis: true, protected: true },
];

function renderAxisColumn(props: Partial<React.ComponentProps<typeof AxisColumn>>) {
  return render(
    <AxisColumn
      activeAxis="all"
      tagPrefixes={[]}
      smartFolders={[]}
      onSelectAxis={vi.fn()}
      selectedTags={[]}
      onToggleTag={vi.fn()}
      onReplaceTag={vi.fn()}
      {...props}
    />,
  );
}

describe("AxisColumn", () => {
  it("選択中のビュー項目に aria-current を付与する", () => {
    renderAxisColumn({
      activeAxis: "fav",
    });

    expect(screen.getByRole("button", { name: /お気に入り/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: /すべての作品/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("tagPrefixes 取得失敗時、CV等のprefix軸が無言で消えず分類軸グループにエラー行を出す", () => {
    renderAxisColumn({
      isTagPrefixesError: true,
    });

    expect(screen.getByText("分類軸の取得に失敗しました")).toBeTruthy();
    // 組み込みのタグ・追加日は tagPrefixes に依存しないため引き続き表示される
    expect(screen.getByRole("button", { name: /タグ/ })).toBeTruthy();
  });

  it("エラー行の再試行ボタンをクリックすると onRetryTagPrefixes を呼ぶ", async () => {
    const onRetry = vi.fn();
    renderAxisColumn({
      isTagPrefixesError: true,
      onRetryTagPrefixes: onRetry,
    });

    await userEvent.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("tagPrefixes 取得成功時はエラー行を出さず、prefix軸を表示する", () => {
    renderAxisColumn({
      tagPrefixes: PREFIXES,
    });

    expect(screen.queryByText("分類軸の取得に失敗しました")).toBeNull();
    expect(screen.getByRole("button", { name: /CV/ })).toBeTruthy();
  });
});
