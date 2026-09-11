import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cn, FONT_SIZE_TOKENS } from "../../src/shared/lib/cn";

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

  it("FONT_SIZE_TOKENS が styles/tailwind.css の --text-* 定義と一致する", () => {
    const tailwindCss = readFileSync(
      resolve(import.meta.dirname, "../../src/styles/tailwind.css"),
      "utf8",
    );
    const cssTokens = new Set(
      [...tailwindCss.matchAll(/--text-([a-z][a-z0-9-]*):/g)]
        .map((match) => match[1])
        // --text-body--line-height 等の付随定義（二重ハイフン区切り）を除外する
        .filter((name) => !name.includes("--"))
        .map((name) => `text-${name}`),
    );
    expect(new Set(FONT_SIZE_TOKENS)).toEqual(cssTokens);
  });

  it("文字サイズトークンは色ユーティリティと衝突せず両方残る", () => {
    for (const token of FONT_SIZE_TOKENS) {
      expect(cn(token, "text-ink-1")).toBe(`${token} text-ink-1`);
      expect(cn("text-paper-1", token)).toBe(`text-paper-1 ${token}`);
      expect(cn(token, "text-acc")).toBe(`${token} text-acc`);
    }
  });

  it("文字サイズトークン同士は同じグループとして後勝ちになる", () => {
    expect(cn("text-body", "text-mono")).toBe("text-mono");
    expect(cn("text-control", "text-label")).toBe("text-label");
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
