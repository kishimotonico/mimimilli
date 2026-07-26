// 通知ベルパネル（TASK-44）の開閉・バッジ件数・各セクションの表示条件のテスト。
import { createElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ScanResult } from "@mimimilli/shared";
import NotificationBell from "../../src/app/ui/NotificationBell";

const scanResult: ScanResult = {
  registered: 12,
  newlyGenerated: 3,
  errors: 1,
  missing: 0,
  newWorkIds: [],
  rjCodeMissingCount: 3,
};

function renderBell(overrides: Partial<Parameters<typeof NotificationBell>[0]> = {}) {
  const props = {
    rjCodeMissingCount: 0,
    onOpenRjCodeMissing: vi.fn(),
    dlsiteFetchFailedCount: 0,
    onOpenDlsiteFetchFailed: vi.fn(),
    dlsiteParseErrorAlert: false,
    dlsiteParseErrorCount: 0,
    onOpenDlsiteParseFailed: vi.fn(),
    dlsiteUnlinkedCount: 0,
    dlsiteBulkActive: false,
    dlsiteBulkProgress: null,
    onStartDlsiteBulk: vi.fn(),
    scanResult: null,
    ...overrides,
  };
  render(createElement(NotificationBell, props));
  return props;
}

describe("NotificationBell", () => {
  it("要対応件数が0件のときはバッジを出さない", () => {
    renderBell();
    expect(screen.getByRole("button", { name: "通知" })).toBeInTheDocument();
  });

  it("バッジ数はRJコード未検出とDLsite取得失敗の合算（DLsite未連携は含めない）", () => {
    renderBell({ rjCodeMissingCount: 3, dlsiteFetchFailedCount: 2, dlsiteUnlinkedCount: 100 });
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "通知（要対応5件）" })).toBeInTheDocument();
  });

  it("クリックでパネルが開閉し、何もなければ空状態を表示する", () => {
    renderBell();
    expect(screen.queryByRole("menu", { name: "通知" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "通知" }));
    expect(screen.getByRole("menu", { name: "通知" })).toBeInTheDocument();
    expect(screen.getByText("対応が必要な通知はありません")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "通知" }));
    expect(screen.queryByRole("menu", { name: "通知" })).toBeNull();
  });

  it("Escapeでパネルを閉じる", () => {
    renderBell({ rjCodeMissingCount: 1 });
    fireEvent.click(screen.getByRole("button", { name: /通知/ }));
    expect(screen.getByRole("menu", { name: "通知" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: "通知" })).toBeNull();
  });

  it("パネル外のクリックで閉じる", () => {
    renderBell({ rjCodeMissingCount: 1 });
    fireEvent.click(screen.getByRole("button", { name: /通知/ }));
    expect(screen.getByRole("menu", { name: "通知" })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu", { name: "通知" })).toBeNull();
  });

  it("RJコード未検出の行クリックでコールバックを呼び、パネルを閉じる", () => {
    const props = renderBell({ rjCodeMissingCount: 3 });
    fireEvent.click(screen.getByRole("button", { name: /通知/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /RJコード未検出/ }));

    expect(props.onOpenRjCodeMissing).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu", { name: "通知" })).toBeNull();
  });

  it("DLsite取得失敗の行クリックでコールバックを呼ぶ", () => {
    const props = renderBell({ dlsiteFetchFailedCount: 2 });
    fireEvent.click(screen.getByRole("button", { name: /通知/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /DLsite取得失敗/ }));

    expect(props.onOpenDlsiteFetchFailed).toHaveBeenCalledTimes(1);
  });

  it("パース失敗アラート時だけバッジにパース失敗件数を加算する", () => {
    renderBell({
      dlsiteParseErrorAlert: true,
      dlsiteParseErrorCount: 4,
      rjCodeMissingCount: 1,
    });
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("パース失敗アラートの行クリックでコールバックを呼ぶ", () => {
    const props = renderBell({ dlsiteParseErrorAlert: true, dlsiteParseErrorCount: 3 });
    fireEvent.click(screen.getByRole("button", { name: /通知/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /DLsiteパース失敗/ }));
    expect(props.onOpenDlsiteParseFailed).toHaveBeenCalledTimes(1);
  });

  it("DLsite未連携: 件数がある場合はまとめて取得ボタンを表示し、押すとコールバックを呼ぶ", () => {
    const props = renderBell({ dlsiteUnlinkedCount: 5 });
    fireEvent.click(screen.getByRole("button", { name: /通知/ }));
    expect(screen.getByText("5件")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "まとめて取得" }));
    expect(props.onStartDlsiteBulk).toHaveBeenCalledTimes(1);
  });

  it("DLsite未連携: 実行中は進捗を表示し、ボタンをdisabledにする", () => {
    renderBell({
      dlsiteUnlinkedCount: 0,
      dlsiteBulkActive: true,
      dlsiteBulkProgress: { processed: 3, total: 8 },
    });
    fireEvent.click(screen.getByRole("button", { name: /通知/ }));
    expect(screen.getByText("取得中 (3/8)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "まとめて取得" })).toBeDisabled();
  });

  it("scanResultがあれば直近のスキャン結果サマリを表示する", () => {
    renderBell({ scanResult });
    fireEvent.click(screen.getByRole("button", { name: /通知/ }));
    expect(screen.getByText("直近のスキャン結果")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
