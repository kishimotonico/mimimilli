import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Toast, {
  TOAST_ACTION_AUTO_DISMISS_MS,
  TOAST_AUTO_DISMISS_MS,
} from "../../src/shared/ui/Toast";
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

  it("action無しは既定5秒で自動的に閉じる", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});
    const onDismiss = vi.fn();

    render(<Toast message="候補から外しました" variant="success" onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS - 1));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("action付きは既定10秒で自動的に閉じる", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});
    const onDismiss = vi.fn();

    render(
      <Toast
        message="タグ「ASMR」を削除しました"
        variant="success"
        actionLabel="元に戻す"
        onAction={() => {}}
        onDismiss={onDismiss}
      />,
    );
    act(() => vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(TOAST_ACTION_AUTO_DISMISS_MS - TOAST_AUTO_DISMISS_MS));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("error variant は自動的に閉じない", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});
    const onDismiss = vi.fn();

    render(<Toast message="取得に失敗しました" variant="error" onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(onDismiss).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("hover中は消去を止め、離れると残り時間から再開する", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});
    const onDismiss = vi.fn();

    render(<Toast message="候補から外しました" variant="success" onDismiss={onDismiss} />);
    const output = screen.getByText("候補から外しました").closest("output");
    if (!output) throw new Error("toast output not found");

    act(() => vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS - 500));
    fireEvent.mouseEnter(output);
    act(() => vi.advanceTimersByTime(10_000));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.mouseLeave(output);
    act(() => vi.advanceTimersByTime(499));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("同じ文面でもrequestKeyが変われば寿命タイマーを取り直す", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});
    const onDismissA = vi.fn();
    const onDismissB = vi.fn();

    const { rerender } = render(
      <Toast
        message="候補から外しました"
        variant="success"
        onDismiss={onDismissA}
        requestKey="a"
      />,
    );
    act(() => vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS - 1));
    // 文面が同じ別要求（requestKeyだけ変わる）に差し替わる
    rerender(
      <Toast
        message="候補から外しました"
        variant="success"
        onDismiss={onDismissB}
        requestKey="b"
      />,
    );
    act(() => vi.advanceTimersByTime(1));
    // 旧要求の寿命が引き継がれていれば、この時点で発火してしまう
    expect(onDismissA).not.toHaveBeenCalled();
    expect(onDismissB).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS - 1));
    expect(onDismissB).toHaveBeenCalledTimes(1);
    expect(onDismissA).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("hoverとfocusは独立に管理し、片方が外れても他方が残っていれば消去を止めたままにする", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "showPopover").mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, "hidePopover").mockImplementation(() => {});
    const onDismiss = vi.fn();

    render(
      <Toast
        message="候補から外しました"
        variant="success"
        actionLabel="元に戻す"
        onAction={() => {}}
        onDismiss={onDismiss}
      />,
    );
    const output = screen.getByText("候補から外しました").closest("output");
    if (!output) throw new Error("toast output not found");

    // マウスでホバーしたままボタンへフォーカスし、その後マウスだけ離れる
    fireEvent.mouseEnter(output);
    fireEvent.focus(output);
    fireEvent.mouseLeave(output);
    act(() => vi.advanceTimersByTime(60_000));
    expect(onDismiss).not.toHaveBeenCalled();

    // 最後にフォーカスも外れたら残り時間から再開する
    fireEvent.blur(output);
    act(() => vi.advanceTimersByTime(TOAST_ACTION_AUTO_DISMISS_MS));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
