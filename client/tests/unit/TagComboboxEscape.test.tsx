// TagComboboxのEscape有効範囲（TASK-428.13）。候補表示中は候補だけを閉じ、
// 候補が閉じている時は編集キャンセル（onCancel）か、無ければ親のdialogへ委ねる。
import { createElement } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TagCombobox from "../../src/shared/ui/TagCombobox";

describe("TagCombobox Escape", () => {
  it("候補表示中のEscapeは候補だけを閉じ、onCancelを呼ばない", () => {
    const onCancel = vi.fn();
    const { getByRole, queryByRole } = render(
      createElement(TagCombobox, {
        suggestions: ["ASMR", "睡眠用"],
        onSelect: vi.fn(),
        onCancel,
      }),
    );
    const input = getByRole("combobox");

    fireEvent.change(input, { target: { value: "ASMR" } });
    expect(queryByRole("listbox")).not.toBeNull();

    const result = fireEvent.keyDown(input, { key: "Escape" });
    expect(result).toBe(false); // preventDefaultされた
    expect(queryByRole("listbox")).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("候補が閉じている時のEscapeはonCancelを呼び、既定動作を止める", () => {
    const onCancel = vi.fn();
    const { getByRole } = render(
      createElement(TagCombobox, {
        suggestions: ["ASMR"],
        onSelect: vi.fn(),
        onCancel,
      }),
    );
    const input = getByRole("combobox");

    const result = fireEvent.keyDown(input, { key: "Escape" });
    expect(result).toBe(false); // preventDefaultされ、ネイティブdialogのcancelへは伝わらない
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("onCancelが無い時、候補が閉じている状態のEscapeは何もせず既定動作へ渡す（親dialogのcancelに委ねる）", () => {
    const { getByRole } = render(
      createElement(TagCombobox, {
        suggestions: ["ASMR"],
        onSelect: vi.fn(),
      }),
    );
    const input = getByRole("combobox");

    const result = fireEvent.keyDown(input, { key: "Escape" });
    expect(result).toBe(true); // preventDefaultされていない
  });

  it("IME変換中のEscapeは候補もonCancelも動かさない", () => {
    const onCancel = vi.fn();
    const { getByRole, queryByRole } = render(
      createElement(TagCombobox, {
        suggestions: ["ASMR"],
        onSelect: vi.fn(),
        onCancel,
      }),
    );
    const input = getByRole("combobox");

    fireEvent.change(input, { target: { value: "ASMR" } });
    expect(queryByRole("listbox")).not.toBeNull();

    fireEvent.keyDown(input, { key: "Escape", isComposing: true });
    expect(queryByRole("listbox")).not.toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
