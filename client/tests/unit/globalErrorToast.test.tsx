import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it } from "vitest";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { errorToastAtom } from "../../src/app/model/errorToastAtom";

describe("GlobalToast", () => {
  it("errorToastAtom のメッセージを表示する", () => {
    const store = createStore();
    store.set(errorToastAtom, "ライブラリのエクスポートに失敗しました");

    render(createElement(JotaiProvider, { store }, createElement(GlobalToast)));

    expect(screen.getByText("ライブラリのエクスポートに失敗しました")).toBeTruthy();
  });
});
