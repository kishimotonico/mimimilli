import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHoverGroupCoordinator } from "../../src/shared/lib/useHoverGroupCoordinator";

function elAt(rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement("div");
  el.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    toJSON: () => ({}),
    ...rect,
  });
  return el;
}

describe("useHoverGroupCoordinator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("トリガーを200msホバーすると開く", () => {
    const { result } = renderHook(() => useHoverGroupCoordinator());
    const elA = elAt({ left: 0, top: 90, bottom: 110 });

    act(() => {
      result.current.getTriggerHandlers("a").onPointerEnter({ currentTarget: elA } as never);
    });
    expect(result.current.openKey).toBeNull();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.openKey).toBe("a");
    expect(result.current.openAnchorEl).toBe(elA);
  });

  it("パネル未登録のままトリガーを離れると150msで閉じる", () => {
    const { result } = renderHook(() => useHoverGroupCoordinator());
    const elA = elAt({ left: 0, top: 90, bottom: 110 });

    act(() => {
      result.current.getTriggerHandlers("a").onPointerEnter({ currentTarget: elA } as never);
      vi.advanceTimersByTime(200);
    });
    expect(result.current.openKey).toBe("a");

    act(() => {
      result.current.getTriggerHandlers("a").onPointerLeave({ clientX: 0, clientY: 100 } as never);
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.openKey).toBeNull();
  });

  it("トリガーからパネルへ直接移動すると閉じない（トリガー⇄パネル間のタイマー共有）", () => {
    const { result } = renderHook(() => useHoverGroupCoordinator());
    const elA = elAt({ left: 0, top: 90, bottom: 110 });
    const panelEl = elAt({ left: 200, top: 50, bottom: 150 });

    act(() => {
      result.current.getTriggerHandlers("a").onPointerEnter({ currentTarget: elA } as never);
      vi.advanceTimersByTime(200);
    });
    result.current.panelElRef.current = panelEl;

    act(() => {
      result.current.getTriggerHandlers("a").onPointerLeave({ clientX: 0, clientY: 100 } as never);
    });
    act(() => {
      result.current.panelHandlers.onPointerEnter();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.openKey).toBe("a");
  });

  it("斜め移動が他のトリガー行の上を通過しても、セーフトライアングル内なら開閉が横取りされない（AC1）", () => {
    const { result } = renderHook(() => useHoverGroupCoordinator());
    const elA = elAt({ left: 0, top: 90, bottom: 110 });
    const elB = elAt({ left: 0, top: 130, bottom: 150 });
    const panelEl = elAt({ left: 200, top: 50, bottom: 150 });

    act(() => {
      result.current.getTriggerHandlers("a").onPointerEnter({ currentTarget: elA } as never);
      vi.advanceTimersByTime(200);
    });
    result.current.panelElRef.current = panelEl;
    expect(result.current.openKey).toBe("a");

    act(() => {
      // apex = トリガーを離れた時点のポインタ位置
      result.current.getTriggerHandlers("a").onPointerLeave({ clientX: 0, clientY: 100 } as never);
    });

    act(() => {
      // apex(0,100) からパネル底辺(x=200)へ向かう直線上の点。b行の上を通過する経路。
      fireEvent.pointerMove(document, { clientX: 100, clientY: 100 });
    });
    act(() => {
      // 経路上でb行にポインタが乗る（三角形内での一時的なホバー）
      result.current.getTriggerHandlers("b").onPointerEnter({ currentTarget: elB } as never);
    });
    act(() => {
      vi.advanceTimersByTime(200); // b行のopen遅延を超えても抑止されたまま
    });

    expect(result.current.openKey).toBe("a");
  });

  it("セーフトライアングル内でもポインタが約300ms静止すると、その行への切り替えが行われる（AC2）", () => {
    const { result } = renderHook(() => useHoverGroupCoordinator());
    const elA = elAt({ left: 0, top: 90, bottom: 110 });
    const elB = elAt({ left: 0, top: 130, bottom: 150 });
    const panelEl = elAt({ left: 200, top: 50, bottom: 150 });

    act(() => {
      result.current.getTriggerHandlers("a").onPointerEnter({ currentTarget: elA } as never);
      vi.advanceTimersByTime(200);
    });
    result.current.panelElRef.current = panelEl;

    act(() => {
      result.current.getTriggerHandlers("a").onPointerLeave({ clientX: 0, clientY: 100 } as never);
    });
    act(() => {
      fireEvent.pointerMove(document, { clientX: 100, clientY: 100 });
    });
    act(() => {
      result.current.getTriggerHandlers("b").onPointerEnter({ currentTarget: elB } as never);
    });
    expect(result.current.openKey).toBe("a");

    act(() => {
      vi.advanceTimersByTime(300); // 三角形内での静止 → 抑止解除
    });
    act(() => {
      vi.advanceTimersByTime(200); // 解除後のb行の通常open遅延
    });

    expect(result.current.openKey).toBe("b");
  });

  it("close() は遅延・セーフトライアングルを打ち切って即座に閉じる", () => {
    const { result } = renderHook(() => useHoverGroupCoordinator());
    const elA = elAt({ left: 0, top: 90, bottom: 110 });
    const panelEl = elAt({ left: 200, top: 50, bottom: 150 });

    act(() => {
      result.current.getTriggerHandlers("a").onPointerEnter({ currentTarget: elA } as never);
      vi.advanceTimersByTime(200);
    });
    result.current.panelElRef.current = panelEl;

    act(() => {
      result.current.getTriggerHandlers("a").onPointerLeave({ clientX: 0, clientY: 100 } as never);
    });
    act(() => {
      result.current.close();
    });

    expect(result.current.openKey).toBeNull();
  });

  it("ガード活性中にアンマウントすると document の pointermove リスナーが解除される（レンダーを跨いでも同一参照）", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { result, rerender, unmount } = renderHook(() => useHoverGroupCoordinator());
    const elA = elAt({ left: 0, top: 90, bottom: 110 });
    const panelEl = elAt({ left: 200, top: 50, bottom: 150 });

    act(() => {
      result.current.getTriggerHandlers("a").onPointerEnter({ currentTarget: elA } as never);
      vi.advanceTimersByTime(200);
    });
    result.current.panelElRef.current = panelEl;

    act(() => {
      // ガード活性化はここで addEventListener("pointermove", ...) を呼ぶ
      result.current.getTriggerHandlers("a").onPointerLeave({ clientX: 0, clientY: 100 } as never);
    });
    const pointerMoveCall = addSpy.mock.calls.find(([type]) => type === "pointermove");
    expect(pointerMoveCall).toBeDefined();
    const registeredHandler = pointerMoveCall![1];

    // ガード活性中にレンダーを挟む（レンダーごとに新しい関数を作っていると
    // ここで生成される関数参照が addEventListener 済みのものとずれる）
    rerender();

    unmount();

    const pointerMoveRemoveCall = removeSpy.mock.calls.find(([type]) => type === "pointermove");
    expect(pointerMoveRemoveCall).toBeDefined();
    expect(pointerMoveRemoveCall![1]).toBe(registeredHandler);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("openImmediately は遅延なしで即座に開く", () => {
    const { result } = renderHook(() => useHoverGroupCoordinator());
    const elA = elAt({ left: 0, top: 90, bottom: 110 });

    act(() => {
      result.current.openImmediately("a", elA);
    });

    expect(result.current.openKey).toBe("a");
  });
});
