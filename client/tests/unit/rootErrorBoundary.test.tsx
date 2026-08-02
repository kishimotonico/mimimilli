import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RootErrorBoundary from "../../src/app/RootErrorBoundary";

function ThrowingChild({ message }: { message: string }) {
  throw new Error(message);
}

describe("RootErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("子が正常なときはそのまま描画する", () => {
    render(
      <RootErrorBoundary>
        <div>正常な子</div>
      </RootErrorBoundary>,
    );

    expect(screen.getByText("正常な子")).toBeInTheDocument();
  });

  it("子が例外を投げたときはエラー表示を出す", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <RootErrorBoundary>
        <ThrowingChild message="テスト用のレンダリングエラー" />
      </RootErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "表示中にエラーが発生しました" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("テスト用のレンダリングエラー");
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
