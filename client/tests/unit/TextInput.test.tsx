import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TextInput from "../../src/shared/ui/TextInput";

describe("TextInput", () => {
  it("ブラウザとパスワード管理アプリの自動入力を抑止する属性を付ける", () => {
    render(<TextInput aria-label="名前" />);
    const input = screen.getByLabelText("名前");

    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("data-1p-ignore");
    expect(input).toHaveAttribute("data-op-ignore");
    expect(input).toHaveAttribute("data-lpignore", "true");
    expect(input).toHaveAttribute("data-bwignore", "true");
    expect(input).toHaveAttribute("data-form-type", "other");
  });

  it("呼び出し側の autoComplete は既定より優先される", () => {
    render(<TextInput aria-label="場所" autoComplete="street-address" />);
    expect(screen.getByLabelText("場所")).toHaveAttribute("autocomplete", "street-address");
  });
});
