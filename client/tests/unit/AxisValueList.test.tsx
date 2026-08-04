import { describe, expect, it, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AxisValueList from "../../src/features/library/ui/AxisValueList";

afterEach(cleanup);

function renderAxisValueList(props: Partial<React.ComponentProps<typeof AxisValueList>> = {}) {
  return render(
    <AxisValueList
      axis="tag"
      facetItems={[]}
      tagPrefixes={[]}
      selectedTags={[]}
      onToggle={vi.fn()}
      {...props}
    />,
  );
}

describe("AxisValueList タグ軸のprefixグループ表示（ADR-0005 追記）", () => {
  it("prefix付きタグをprefixグループ見出し付きで表示し、フラットタグは「タグ」見出しにまとまる", () => {
    const { container } = renderAxisValueList({
      axis: "tag",
      facetItems: [
        { value: "ASMR", count: 5, durationSec: 0, covers: [] },
        { value: "cv/藤田茜", count: 3, durationSec: 0, covers: [] },
        { value: "サークル/夜想曲", count: 2, durationSec: 0, covers: [] },
      ],
      tagPrefixes: [
        { prefix: "cv", label: "CV", color: "cv", showAsAxis: true, protected: true },
        {
          prefix: "サークル",
          label: "サークル",
          color: "circle",
          showAsAxis: true,
          protected: true,
        },
      ],
    });

    const headings = Array.from(container.querySelectorAll(".mll-taggroup .mll-axisgroup__hd")).map(
      (el) => el.textContent,
    );
    expect(headings).toEqual(["タグ", "CV", "サークル"]);

    const rows = container.querySelectorAll(".mll-tagrow .nm");
    expect(Array.from(rows).map((el) => el.textContent)).toEqual(["ASMR", "藤田茜", "夜想曲"]);
  });

  it("見出しの件数はグループ化前の全タグ件数を表示する", () => {
    const { container } = renderAxisValueList({
      axis: "tag",
      facetItems: [
        { value: "ASMR", count: 5, durationSec: 0, covers: [] },
        { value: "cv/藤田茜", count: 3, durationSec: 0, covers: [] },
      ],
    });
    const hd = container.querySelector(".mle-col__hd .count");
    expect(hd?.textContent).toBe("2 件");
  });
});

describe("AxisValueList 選択・トグル", () => {
  it("tag 軸: 完全なタグ文字列をそのまま onToggle へ渡す", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderAxisValueList({
      axis: "tag",
      facetItems: [{ value: "cv/藤田茜", count: 1, durationSec: 0, covers: [] }],
      onToggle,
    });

    await user.click(screen.getByText("藤田茜"));
    expect(onToggle).toHaveBeenCalledWith("cv/藤田茜");
  });

  it("facet 軸（cv等）: 軸名/値 の擬似タグを組み立てて onToggle へ渡す", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderAxisValueList({
      axis: "cv",
      facetItems: [{ value: "藤田茜", count: 1, durationSec: 0, covers: [] }],
      onToggle,
    });

    await user.click(screen.getByText("藤田茜"));
    expect(onToggle).toHaveBeenCalledWith("cv/藤田茜");
  });

  it("year 軸: year/値 の擬似タグを組み立てる", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderAxisValueList({
      axis: "year",
      facetItems: [{ value: "2024", count: 1, durationSec: 0, covers: [] }],
      onToggle,
    });

    await user.click(screen.getByText("2024"));
    expect(onToggle).toHaveBeenCalledWith("year/2024");
  });

  it("選択中の値は aria-pressed=true になる", () => {
    renderAxisValueList({
      axis: "cv",
      facetItems: [{ value: "藤田茜", count: 1, durationSec: 0, covers: [] }],
      selectedTags: ["cv/藤田茜"],
    });

    expect(screen.getByRole("button", { name: /藤田茜/ })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("AxisValueList エラー・空状態の再試行導線", () => {
  it("タグ軸の isFacetError で再試行ボタンをクリックすると onRetryFacets を呼ぶ", async () => {
    const onRetryFacets = vi.fn();
    const user = userEvent.setup();
    renderAxisValueList({
      axis: "tag",
      isFacetError: true,
      facetItems: [{ value: "tag-a", count: 3, durationSec: 0, covers: [] }],
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
    const { container } = renderAxisValueList({
      axis: "tag",
      facetItems: [{ value: "ASMR", count: 5, durationSec: 0, covers: [] }],
      isFacetLoading: true,
    });
    expect(container.querySelector(".mle-col__hd .count")).toBeNull();
  });
});
