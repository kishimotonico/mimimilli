import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Button from "../../src/shared/ui/Button";

describe("Button の softDisabled", () => {
  it("フォーカスを残し、見た目と aria-disabled を無効にして、押しても Enter・Space でも onClick を呼ばない", async () => {
    const user = userEvent.setup();
    const clicked = vi.fn();
    const { rerender } = render(<Button onClick={clicked}>実行</Button>);
    const button = screen.getByRole("button", { name: "実行" });
    button.focus();
    rerender(
      <Button onClick={clicked} softDisabled>
        実行
      </Button>,
    );
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    expect(button.className).toContain("text-ink-4");
    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard("[Space]");
    expect(button).toHaveFocus();
    expect(clicked).not.toHaveBeenCalled();
    rerender(<Button onClick={clicked}>実行</Button>);
    await user.click(button);
    expect(clicked).toHaveBeenCalledTimes(1);
  });
});
