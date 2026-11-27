import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useElementWidth } from "../../src/shared/ui/useElementWidth";
import { getResizeObservers } from "./setup";

it("useElementWidthは要素の幅を監視し、監視先が無くなれば解除する", () => {
  const element = document.createElement("div");
  const measure = vi
    .spyOn(element, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(0, 0, 300, 20));
  function Width({ target }: { target: HTMLElement | null }) {
    return <output aria-label="幅">{useElementWidth(target) ?? "なし"}</output>;
  }
  const { rerender } = render(<Width target={element} />);
  const observer = getResizeObservers().find((item) => item.getObserved().includes(element));
  expect(observer).toBeDefined();
  expect(screen.getByLabelText("幅")).toHaveTextContent("300");
  const resized = new DOMRect(0, 0, 340, 20);
  measure.mockReturnValue(resized);
  act(() => observer?.flush([{ target: element, contentRect: resized }]));
  expect(screen.getByLabelText("幅")).toHaveTextContent("340");
  rerender(<Width target={null} />);
  expect(observer?.getObserved()).toEqual([]);
  expect(screen.getByLabelText("幅")).toHaveTextContent("なし");
});
