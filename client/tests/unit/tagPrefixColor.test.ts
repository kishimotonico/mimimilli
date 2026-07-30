import { describe, expect, it } from "vitest";
import { DEFAULT_TAG_PREFIXES } from "@mimimilli/shared";
import {
  TAG_PREFIX_COLOR_CSS_VARS,
  tagPrefixColorToCss,
} from "../../src/entities/work/tagPrefixColor";

describe("tagPrefixColorToCss", () => {
  it("maps each semantic key to the matching tokens.css variable", () => {
    expect(tagPrefixColorToCss("cv")).toBe("var(--cv-color)");
    expect(tagPrefixColorToCss("circle")).toBe("var(--circle-color)");
    expect(tagPrefixColorToCss("series")).toBe("var(--series-color)");
    expect(tagPrefixColorToCss("cat")).toBe("var(--cat-color)");
  });

  it("falls back to cat when color is null or undefined", () => {
    expect(tagPrefixColorToCss(null)).toBe("var(--cat-color)");
    expect(tagPrefixColorToCss(undefined)).toBe("var(--cat-color)");
  });

  it("keeps default seeded prefixes visually equivalent to the old direct CSS vars", () => {
    const legacyByPrefix: Record<string, string> = {
      cv: "var(--cv-color)",
      サークル: "var(--circle-color)",
      シリーズ: "var(--series-color)",
      カテゴリ: "var(--cat-color)",
      genre: "var(--cat-color)",
    };

    for (const def of DEFAULT_TAG_PREFIXES) {
      expect(tagPrefixColorToCss(def.color)).toBe(legacyByPrefix[def.prefix]);
    }
  });

  it("covers every declared key in TAG_PREFIX_COLOR_CSS_VARS", () => {
    for (const [key, cssVar] of Object.entries(TAG_PREFIX_COLOR_CSS_VARS)) {
      expect(tagPrefixColorToCss(key as keyof typeof TAG_PREFIX_COLOR_CSS_VARS)).toBe(cssVar);
    }
  });
});
