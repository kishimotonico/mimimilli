import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "../../src/shared/lib/useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("初期値はそのまま返る", () => {
    const { result } = renderHook(({ v }) => useDebouncedValue(v, 250), {
      initialProps: { v: "a" },
    });
    expect(result.current).toBe("a");
  });

  it("値の変更はdelay経過後に反映される", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 250), {
      initialProps: { v: "a" },
    });
    rerender({ v: "ab" });
    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe("ab");
  });

  it("delay未満の連続変更は最新値のみ反映される", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 250), {
      initialProps: { v: "a" },
    });
    rerender({ v: "ab" });
    act(() => {
      vi.advanceTimersByTime(100); // t=100: "ab" のタイマー(t=250発火)は残っている
    });
    rerender({ v: "abc" }); // "abc" のタイマー(t=350発火)に仕掛け直し
    act(() => {
      vi.advanceTimersByTime(249); // t=349: まだ未発火
    });
    expect(result.current).toBe("a");
    act(() => {
      vi.advanceTimersByTime(1); // t=350: 最新値だけが発火する
    });
    expect(result.current).toBe("abc");
  });

  it("immediate=true の間は待機なしで即時反映される", () => {
    const { result, rerender } = renderHook(
      ({ v, imm }: { v: string; imm: boolean }) => useDebouncedValue(v, 250, imm),
      { initialProps: { v: "abc", imm: false } },
    );
    act(() => {
      vi.advanceTimersByTime(250);
    });
    rerender({ v: "", imm: true });
    expect(result.current).toBe("");
  });
});
