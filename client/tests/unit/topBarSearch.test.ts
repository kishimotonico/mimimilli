// TASK-61: 検索入力の IME composition 対応とクリア動作の検証。

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TopBar from "../../src/app/ui/TopBar";

const PLACEHOLDER = /ライブラリを検索/;

function renderTopBar(searchQuery: string, onSearchChange = vi.fn()) {
  render(createElement(TopBar, { searchQuery, onSearchChange }));
  return onSearchChange;
}

describe("TopBar の検索入力", () => {
  it("通常入力は即時表示され親へも即時通知される", () => {
    const onSearchChange = renderTopBar("");
    const input = screen.getByPlaceholderText(PLACEHOLDER);

    fireEvent.change(input, { target: { value: "asmr" } });
    expect(input).toHaveValue("asmr");
    expect(onSearchChange).toHaveBeenCalledWith("asmr");
  });

  it("IME composition 中は親へ通知せず表示だけ更新し、確定時に通知する", () => {
    const onSearchChange = renderTopBar("");
    const input = screen.getByPlaceholderText(PLACEHOLDER);

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "あ" } });
    fireEvent.change(input, { target: { value: "あい" } });
    // composition 中間文字列では親へ通知しない（表示は追従する）
    expect(onSearchChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("あい");

    fireEvent.compositionEnd(input);
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith("あい");
  });

  it("クリアボタンで表示・親通知ともに即時空になる", () => {
    const onSearchChange = renderTopBar("asmr");
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    expect(input).toHaveValue("asmr");

    fireEvent.click(screen.getByRole("button", { name: "検索をクリア" }));
    expect(onSearchChange).toHaveBeenCalledWith("");
    expect(input).toHaveValue("");
  });

  it("親の値が外部要因で変わったとき表示が追従する", () => {
    const onSearchChange = vi.fn();
    const { rerender } = render(createElement(TopBar, { searchQuery: "", onSearchChange }));
    const input = screen.getByPlaceholderText(PLACEHOLDER);

    rerender(createElement(TopBar, { searchQuery: "復元された語", onSearchChange }));
    expect(input).toHaveValue("復元された語");
  });
});
