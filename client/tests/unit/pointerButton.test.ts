import { describe, expect, it } from "vitest";
import { isPrimaryPointerButton } from "../../src/shared/lib/pointerButton";

describe("isPrimaryPointerButton", () => {
  it("button===0（主ボタン・タッチ・ペン）のみtrue", () => {
    expect(isPrimaryPointerButton({ button: 0 })).toBe(true);
  });

  it("中央・右クリックはfalse", () => {
    expect(isPrimaryPointerButton({ button: 1 })).toBe(false);
    expect(isPrimaryPointerButton({ button: 2 })).toBe(false);
  });
});
