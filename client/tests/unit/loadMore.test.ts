// TASK-73: 追加読み込みボタン LoadMore の表示・挙動検証。

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import LoadMore from "../../src/features/library/ui/LoadMore";

describe("LoadMore", () => {
  it("残件数を表示する", () => {
    render(
      createElement(LoadMore, {
        loadedCount: 5,
        totalCount: 12,
        isFetching: false,
        onLoadMore: vi.fn(),
      }),
    );
    expect(screen.getByRole("button")).toHaveTextContent("さらに読み込む（残り 7 件）");
  });

  it("総件数が未定のときはラベルを省略する", () => {
    render(createElement(LoadMore, { loadedCount: 5, isFetching: false, onLoadMore: vi.fn() }));
    expect(screen.getByRole("button")).toHaveTextContent("さらに読み込む");
    expect(screen.getByRole("button")).not.toHaveTextContent("残り");
  });

  it("取得中は disabled となり「読み込み中...」と表示される", () => {
    render(
      createElement(LoadMore, {
        loadedCount: 5,
        totalCount: 12,
        isFetching: true,
        onLoadMore: vi.fn(),
      }),
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("読み込み中...");
  });

  it("クリックで onLoadMore を呼び出す", () => {
    const onLoadMore = vi.fn();
    render(
      createElement(LoadMore, { loadedCount: 5, totalCount: 12, isFetching: false, onLoadMore }),
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
