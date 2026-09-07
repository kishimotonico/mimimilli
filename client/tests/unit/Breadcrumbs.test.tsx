import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import Breadcrumbs from "../../src/shared/ui/Breadcrumbs";
import { clearResizeObservers, flushAllResizeObservers } from "./setup";

afterEach(() => {
  cleanup();
  clearResizeObservers();
});

/** コンテナ・測定用クローンの幅を直接スタブしてから ResizeObserver を発火させる。
 *  Breadcrumbs は contentRect ではなく実 DOM の clientWidth/scrollWidth を読み直すため、
 *  発火自体はきっかけとして使えればよい（TASK-429）。 */
function stubWidths(container: HTMLElement, containerWidth: number, measureWidth: number) {
  const crumbs = container.querySelector(".mle-crumbs") as HTMLElement;
  const measure = container.querySelector(".mle-crumbs__measure") as HTMLElement;
  Object.defineProperty(crumbs, "clientWidth", { configurable: true, value: containerWidth });
  Object.defineProperty(measure, "scrollWidth", { configurable: true, value: measureWidth });
  act(() => flushAllResizeObservers());
}

describe("Breadcrumbs", () => {
  it("十分な幅がある場合は全階層をそのまま表示する", () => {
    const path = ["ルート", "a", "b", "c", "現在地"];
    const { container } = render(<Breadcrumbs path={path} onNavigate={vi.fn()} />);
    stubWidths(container, 800, 400);

    for (const seg of path) {
      expect(screen.getByRole("button", { name: seg })).toBeInTheDocument();
    }
    expect(screen.queryByText("…")).not.toBeInTheDocument();
  });

  it("幅不足時は中間階層を省略し、先頭・直近・現在地を維持する（AC#2）", () => {
    const path = ["ルート", "a", "b", "c", "現在地"];
    const { container } = render(<Breadcrumbs path={path} onNavigate={vi.fn()} />);
    stubWidths(container, 200, 800);

    expect(screen.getByRole("button", { name: "ルート" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "c" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "現在地" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "a" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "b" })).not.toBeInTheDocument();
    expect(screen.getByText("…")).toBeInTheDocument();
  });

  it("セグメントが3つ以下なら幅不足でも省略しない", () => {
    const path = ["ルート", "a", "現在地"];
    const { container } = render(<Breadcrumbs path={path} onNavigate={vi.fn()} />);
    stubWidths(container, 50, 800);

    for (const seg of path) {
      expect(screen.getByRole("button", { name: seg })).toBeInTheDocument();
    }
    expect(screen.queryByText("…")).not.toBeInTheDocument();
  });

  it("省略中の祖先セグメントをクリックすると元のindexでonNavigateが呼ばれる（AC#1）", () => {
    const path = ["ルート", "a", "b", "c", "現在地"];
    const onNavigate = vi.fn();
    const { container } = render(<Breadcrumbs path={path} onNavigate={onNavigate} />);
    stubWidths(container, 200, 800);

    fireEvent.click(screen.getByRole("button", { name: "c" }));
    expect(onNavigate).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole("button", { name: "ルート" }));
    expect(onNavigate).toHaveBeenCalledWith(0);
  });

  it("幅測定用クローンのラベルはテキストノードではないため、getByTextが実体と二重ヒットしない", () => {
    const path = ["ルート", "現在地"];
    render(<Breadcrumbs path={path} onNavigate={vi.fn()} />);

    // 折返し不要な短いpathでもクローン自体は常に描画されるため、
    // ::before(content: attr(data-label))化していないと本来ここで2件ヒットする
    expect(screen.getAllByText("現在地")).toHaveLength(1);
    expect(screen.getAllByText("ルート")).toHaveLength(1);
  });
});
