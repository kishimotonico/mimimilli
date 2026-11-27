import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
