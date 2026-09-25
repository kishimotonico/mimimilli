import { describe, expect, it } from "vitest";
import { createPlayRequestGuard } from "../../src/app/model/playRequestGuard";

describe("createPlayRequestGuard", () => {
  it("最新のトークンだけがisCurrentになる", () => {
    const guard = createPlayRequestGuard();
    const first = guard.next();
    expect(guard.isCurrent(first)).toBe(true);

    const second = guard.next();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it("invalidateすると進行中のトークンがisCurrentでなくなる（root再設定突入時の再生ガードに使う）", () => {
    const guard = createPlayRequestGuard();
    const inFlight = guard.next();
    expect(guard.isCurrent(inFlight)).toBe(true);

    guard.invalidate();

    expect(guard.isCurrent(inFlight)).toBe(false);
  });

  it("invalidate後の新しいnextは有効なトークンを発行する", () => {
    const guard = createPlayRequestGuard();
    guard.next();
    guard.invalidate();

    const fresh = guard.next();
    expect(guard.isCurrent(fresh)).toBe(true);
  });
});
