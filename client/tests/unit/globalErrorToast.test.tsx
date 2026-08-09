import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it } from "vitest";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { errorToastAtom } from "../../src/shared/model/errorToastAtom";
import { scanErrorAtom } from "../../src/features/scan/model/atoms";
import { dlsiteBulkErrorAtom } from "../../src/features/dlsite/model/atoms";

describe("GlobalToast", () => {
  it("errorToastAtom のメッセージを表示する", () => {
    const store = createStore();
    store.set(errorToastAtom, "ライブラリのエクスポートに失敗しました");

    render(createElement(JotaiProvider, { store }, createElement(GlobalToast)));

    expect(screen.getByText("ライブラリのエクスポートに失敗しました")).toBeTruthy();
  });

  it("scanErrorAtom のメッセージを表示する", () => {
    const store = createStore();
    store.set(scanErrorAtom, "start failed");

    render(createElement(JotaiProvider, { store }, createElement(GlobalToast)));

    expect(screen.getByText("start failed")).toBeTruthy();
  });

  it("dlsiteBulkErrorAtom のメッセージを表示する", () => {
    const store = createStore();
    store.set(dlsiteBulkErrorAtom, "一括取得の中止に失敗しました");

    render(createElement(JotaiProvider, { store }, createElement(GlobalToast)));

    expect(screen.getByText("一括取得の中止に失敗しました")).toBeTruthy();
  });
});
