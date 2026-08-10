import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CollectionStatus from "../../src/shared/ui/CollectionStatus";

afterEach(cleanup);

describe("CollectionStatus", () => {
  it("kind=loading はスケルトンを表示し、role=status で読み込み中を通知する", () => {
    const { container } = render(<CollectionStatus variant="list" kind="loading" />);

    expect(screen.getByRole("status")).toHaveTextContent("読み込み中...");
    expect(container.querySelector(".mll-status-skeleton")).toBeTruthy();
  });

  it("kind=error は固定メッセージを role=status で通知する", () => {
    render(<CollectionStatus variant="grid" kind="error" />);

    expect(screen.getByRole("status")).toHaveTextContent("読み込みに失敗しました");
  });

  it("kind=error かつ onRetry があれば再試行ボタンを出し、クリックで呼ばれる", async () => {
    const onRetry = vi.fn();
    render(<CollectionStatus variant="list" kind="error" onRetry={onRetry} />);

    const button = screen.getByRole("button", { name: "再試行" });
    await userEvent.click(button);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("kind=error かつ onRetry がなければ再試行ボタンを出さない", () => {
    render(<CollectionStatus variant="list" kind="error" />);

    expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
  });

  it("kind=empty は message と hint を表示する", () => {
    render(<CollectionStatus variant="list" kind="empty" message="項目がありません" hint="補足" />);

    expect(screen.getByText("項目がありません")).toBeTruthy();
    expect(screen.getByText("補足")).toBeTruthy();
  });
});
