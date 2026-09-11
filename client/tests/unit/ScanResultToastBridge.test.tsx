import { createElement, Fragment } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanResult } from "@mimimilli/shared";
import ScanResultToastBridge from "../../src/app/ui/ScanResultToastBridge";
import GlobalToast from "../../src/app/ui/GlobalToast";
import { scanResultToastAtom } from "../../src/entities/scan/model/atoms";
import { activeModalAtom } from "../../src/shared/model/activeModalAtom";

const baseResult: ScanResult = {
  registered: 12,
  insertedWorkIds: ["a", "b"],
  updatedWorkIds: [],
  errors: 0,
  missing: 0,
  rjCodeMissingCount: 0,
  skipped: 0,
  coverErrors: 0,
  identityConflicts: [],
  invalidMetaFiles: [],
  candidates: [],
};

function renderBridge(store: ReturnType<typeof createStore>) {
  render(
    createElement(
      JotaiProvider,
      { store },
      createElement(
        Fragment,
        null,
        createElement(ScanResultToastBridge),
        createElement(GlobalToast),
      ),
    ),
  );
}

describe("ScanResultToastBridge", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});
  });

  it("要対応が無ければ登録・新規・エラー・欠損数だけを出し、アクションは付けない", () => {
    const store = createStore();
    store.set(scanResultToastAtom, { kind: "completed", result: baseResult });

    renderBridge(store);

    expect(
      screen.getByText("スキャン完了: 登録 12件・新規 2件・エラー 0件・行方不明 0件"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "要対応を見る" })).toBeNull();
  });

  it("要対応があれば「要対応を見る」を押すとコールバックを呼び、トーストも閉じる", async () => {
    const store = createStore();
    store.set(scanResultToastAtom, {
      kind: "completed",
      result: { ...baseResult, rjCodeMissingCount: 1 },
    });
    renderBridge(store);

    fireEvent.click(screen.getByRole("button", { name: "要対応を見る" }));

    expect(store.get(activeModalAtom)).toEqual({ kind: "scan", tab: "needsAttention" });
    // 退出アニメーション中はボタンが残るため、消えるまで待つ（motion）
    await waitFor(() => expect(screen.queryByRole("button", { name: "要対応を見る" })).toBeNull());
  });

  it("中止時は「スキャンを中止しました」を出す", () => {
    const store = createStore();
    store.set(scanResultToastAtom, { kind: "cancelled" });

    renderBridge(store);

    expect(screen.getByText("スキャンを中止しました")).toBeTruthy();
  });

  it("表示要求へ変換した後はscanResultToastAtomを消費して一度きりにする", async () => {
    const store = createStore();
    store.set(scanResultToastAtom, { kind: "completed", result: baseResult });

    renderBridge(store);

    await waitFor(() => expect(store.get(scanResultToastAtom)).toBeNull());
  });
});
