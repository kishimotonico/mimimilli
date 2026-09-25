import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RootConfigurationScreen from "../../src/features/setup/ui/RootConfigurationScreen";

describe("RootConfigurationScreen", () => {
  it("running: 対象rootと進捗を表示し、入力・再試行は出さない", () => {
    render(
      createElement(RootConfigurationScreen, {
        state: {
          status: "running",
          rootFolder: "/audio/library",
          progress: { phase: "walking", processed: 3, total: 10 },
        },
        onSubmit: vi.fn(),
      }),
    );

    expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument();
    expect(screen.getByText("/audio/library")).toBeInTheDocument();
    expect(screen.getByText(/フォルダーを走査中/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /再試行/ })).not.toBeInTheDocument();
  });

  it("failed: エラーメッセージと再試行フォームを表示し、送信でonSubmitを呼ぶ", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      createElement(RootConfigurationScreen, {
        state: {
          status: "failed",
          rootFolder: "/audio/library",
          message: "ルートフォルダーにアクセスできません",
        },
        onSubmit,
      }),
    );

    expect(screen.getByText("ライブラリの再構築に失敗しました")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("ルートフォルダーにアクセスできません");

    const input = screen.getByLabelText("ルートフォルダーのパス");
    fireEvent.change(input, { target: { value: "/audio/library-2" } });
    fireEvent.click(screen.getByRole("button", { name: /再試行/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("/audio/library-2"));
  });

  it("failed: 再試行が失敗したら新しいエラーを表示する", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("再試行に失敗しました"));
    render(
      createElement(RootConfigurationScreen, {
        state: { status: "failed", rootFolder: "/audio/library", message: "初回の失敗理由" },
        onSubmit,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /再試行/ }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("再試行に失敗しました"),
    );
  });
});
