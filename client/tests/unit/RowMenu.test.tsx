import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import RowMenu from "../../src/features/scan/ui/scanModal/unregistered/RowMenu";

it("危険な項目は区切り線の下に置く", async () => {
  render(<RowMenu label="メニュー" busy={false} onOpenFolder={vi.fn()} onExclude={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "メニュー" }));
  expect(screen.getByRole("separator").nextElementSibling).toHaveTextContent("除外");
});
