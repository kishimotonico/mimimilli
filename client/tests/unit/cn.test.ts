import { describe, expect, it } from "vitest";
import { cn } from "../../src/shared/lib/cn";

describe("cn", () => {
  it("ignores falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("merges custom rounded scale conflicts", () => {
    expect(cn("rounded-1 h-5 w-5", "rounded-2")).toBe("h-5 w-5 rounded-2");
    expect(cn("rounded-pill", "rounded-1")).toBe("rounded-1");
  });

  it("merges custom color token conflicts", () => {
    expect(cn("bg-paper-1", "bg-paper-2")).toBe("bg-paper-2");
    expect(cn("text-ink-1", "text-ink-2")).toBe("text-ink-2");
    expect(cn("bg-acc-soft text-acc", "text-ink-1")).toBe("bg-acc-soft text-ink-1");
  });

  it("resolves IconButton box class override via className", () => {
    const result = cn(
      "inline-flex shrink-0 items-center justify-center",
      "h-5 w-5 rounded-1",
      "text-ink-1",
      "rounded-2",
    );
    expect(result).toBe(
      "inline-flex shrink-0 items-center justify-center h-5 w-5 text-ink-1 rounded-2",
    );
    expect(result).not.toContain("rounded-1");
  });
});
