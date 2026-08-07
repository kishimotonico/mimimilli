import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Toast from "../../src/shared/ui/Toast";
import { setMatchMediaReducedMotion } from "./setup";

describe("Toast", () => {
  afterEach(() => {
    cleanupSpies();
    setMatchMediaReducedMotion(false);
  });

  function cleanupSpies() {
    vi.restoreAllMocks();
  }

  it("popover=manual で top layer に載せ、メッセージ表示時に showPopover を呼ぶ", () => {
    const showPopover = vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});

    render(<Toast message="ライブラリのエクスポートに失敗しました" onDismiss={() => {}} />);

    const popover = document.body.querySelector("[popover='manual']");
    expect(popover).toBeTruthy();
    expect(screen.getByText("ライブラリのエクスポートに失敗しました")).toBeTruthy();
    expect(showPopover).toHaveBeenCalled();
  });

  it("非表示時は退出アニメーション完了まで文言が消えず、完了後に hidePopover を呼ぶ", async () => {
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    const hidePopover = vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});

    const { rerender } = render(<Toast message="エラー" onDismiss={() => {}} />);
    act(() => {
      rerender(<Toast message={null} onDismiss={() => {}} />);
    });

    // 退出アニメーション中も文言は消えない（AnimatePresence が最後の要素を凍結表示する）
    expect(screen.getByText("エラー")).toBeTruthy();
    expect(hidePopover).not.toHaveBeenCalled();

    await waitFor(() => expect(hidePopover).toHaveBeenCalled());
  });

  it("退出中のトーストボタンは inert になっている", () => {
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});

    const { rerender } = render(
      <Toast message="エラー" actionLabel="元に戻す" onAction={() => {}} onDismiss={() => {}} />,
    );
    const output = screen.getByText("エラー").closest("output");
    expect(output).not.toHaveAttribute("inert");

    act(() => {
      rerender(
        <Toast message={null} actionLabel="元に戻す" onAction={() => {}} onDismiss={() => {}} />,
      );
    });
    expect(output).toHaveAttribute("inert");
  });

  it("退出中に新しいトーストが割り込んでも、古い退出の hidePopover に隠されない", async () => {
    // ToastContent はキー無しで単一スロットに描画されるため、全トーストが同一キー("")を
    // 共有する。AnimatePresence はexit中に同一キーが再出現すると退出を中断してそのスロットを
    // 新しい子に差し替えるため、この経路では中断された古いexitのonExitCompleteは発火しない。
    setMatchMediaReducedMotion(true);
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    const hidePopover = vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});

    const { rerender } = render(<Toast message="トーストA" onDismiss={() => {}} />);
    rerender(<Toast message={null} onDismiss={() => {}} />);
    // 退出が完了するより前に、新しいトーストが割り込む
    rerender(<Toast message="トーストB" onDismiss={() => {}} />);

    // 退出アニメーション相当の時間が経過してもなお、hidePopover は呼ばれない（呼ばれれば B も隠れてしまう）
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hidePopover).not.toHaveBeenCalled();
    expect(screen.getByText("トーストB")).toBeTruthy();
  });
});
