import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import IconButton from "../../src/shared/ui/IconButton";
import { I } from "../../src/shared/ui/Icon";

describe("IconButton の文字色", () => {
  it("tone=muted は有効時 ink-2、無効時は ink-4 が勝つ", () => {
    const { rerender } = render(<IconButton icon={I.x} label="閉じる" tone="muted" />);
    expect(screen.getByRole("button").className).toContain("text-ink-2");
    rerender(<IconButton icon={I.x} label="閉じる" tone="muted" disabled />);
    const className = screen.getByRole("button").className;
    expect(className).toContain("text-ink-4");
    expect(className).not.toContain("text-ink-2");
  });
});

describe("IconButton の softDisabled", () => {
  it("フォーカスを残し、見た目と aria-disabled と自分の onClick だけを無効にする", async () => {
    const user = userEvent.setup();
    const clicked = vi.fn();
    const { rerender } = render(<IconButton icon={I.x} label="追加" onClick={clicked} />);
    const button = screen.getByRole("button", { name: "追加" });
    button.focus();
    rerender(<IconButton icon={I.x} label="追加" onClick={clicked} softDisabled />);
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard("[Space]");
    expect(button).toHaveFocus();
    expect(clicked).not.toHaveBeenCalled();
    rerender(<IconButton icon={I.x} label="追加" disabled />);
    expect(button).toBeDisabled();
  });
});
