// TagComboboxの候補は外側クリック・フォーカス移動・スクロールでも閉じる（TASK-428.23）。
import { createElement } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TagCombobox from "../../src/shared/ui/TagCombobox";

describe("TagCombobox 候補の外側での閉じ方", () => {
  it("外側のpointerdownで候補が閉じる", () => {
    const { getByRole, queryByRole } = render(
      createElement(
        "div",
        null,
        createElement(TagCombobox, { suggestions: ["ASMR"], onSelect: vi.fn() }),
        createElement("button", { type: "button" }, "外側"),
      ),
    );
    const input = getByRole("combobox");
    fireEvent.change(input, { target: { value: "ASMR" } });
    expect(queryByRole("listbox")).not.toBeNull();

    fireEvent.pointerDown(document.body);
    expect(queryByRole("listbox")).toBeNull();
  });

  it("候補内へのpointerdownでは閉じない", () => {
    const { getByRole, queryByRole } = render(
      createElement(TagCombobox, { suggestions: ["ASMR"], onSelect: vi.fn() }),
    );
    const input = getByRole("combobox");
    fireEvent.change(input, { target: { value: "ASMR" } });
    const option = getByRole("option", { name: "ASMR" });

    fireEvent.pointerDown(option);
    expect(queryByRole("listbox")).not.toBeNull();
  });

  it("フォーカスが外へ移ると候補が閉じる", () => {
    const { getByRole, queryByRole } = render(
      createElement(
        "div",
        null,
        createElement(TagCombobox, { suggestions: ["ASMR"], onSelect: vi.fn() }),
        createElement("button", { type: "button", "data-testid": "outside" }, "外側"),
      ),
    );
    const input = getByRole("combobox");
    fireEvent.change(input, { target: { value: "ASMR" } });
    expect(queryByRole("listbox")).not.toBeNull();

    const outside = document.querySelector('[data-testid="outside"]') as HTMLElement;
    fireEvent.blur(input, { relatedTarget: outside });
    expect(queryByRole("listbox")).toBeNull();
  });

  it("スクロールで候補が閉じる", () => {
    const { getByRole, queryByRole } = render(
      createElement(TagCombobox, { suggestions: ["ASMR"], onSelect: vi.fn() }),
    );
    const input = getByRole("combobox");
    fireEvent.change(input, { target: { value: "ASMR" } });
    expect(queryByRole("listbox")).not.toBeNull();

    fireEvent.scroll(window);
    expect(queryByRole("listbox")).toBeNull();
  });
});
