import { describe, expect, it } from "vitest";
import type { Condition } from "@mimimilli/shared";
import {
  buildEmptyWorksHint,
  buildEmptyWorksMessage,
} from "../../src/features/library/model/emptyWorks";

describe("buildEmptyWorksMessage", () => {
  it("shows a generic message when nothing narrows the result", () => {
    expect(buildEmptyWorksMessage("", false)).toBe("作品が見つかりません");
  });

  it("mentions the search query alone", () => {
    expect(buildEmptyWorksMessage("癒し", false)).toBe("「癒し」に一致する作品はありません");
  });

  it("mentions the selected tag filter alone", () => {
    expect(buildEmptyWorksMessage("", true)).toBe("選択中のフィルタに一致する作品はありません");
  });

  it("combines search query and selected tag filter when both narrow the result", () => {
    expect(buildEmptyWorksMessage("癒し", true)).toBe(
      "「癒し」・選択中のフィルタ に一致する作品はありません",
    );
  });
});

describe("buildEmptyWorksHint（条件の形で決める）", () => {
  const and = (...children: Condition[]): Condition => ({ type: "and", children });

  it("adds context for a bookmarked-only folder when not filtered", () => {
    expect(buildEmptyWorksHint(and({ type: "bookmarked" }), false)).toBe(
      "作品をブックマークするとお気に入りに表示されます",
    );
  });

  it("adds context for a hasError-only folder when not filtered", () => {
    expect(buildEmptyWorksHint(and({ type: "hasError" }), false)).toBe(
      "元ファイルが見つからない・メタデータの読み込みに失敗した作品はここに表示されます",
    );
  });

  it("omits hint when the empty state is due to a filter (search/tags)", () => {
    expect(buildEmptyWorksHint(and({ type: "bookmarked" }), true)).toBeUndefined();
    expect(buildEmptyWorksHint(and({ type: "hasError" }), true)).toBeUndefined();
  });

  it("omits hint for conditions without a specific context", () => {
    expect(buildEmptyWorksHint(and(), false)).toBeUndefined();
    expect(buildEmptyWorksHint(and({ type: "played" }), false)).toBeUndefined();
    expect(buildEmptyWorksHint(null, false)).toBeUndefined();
  });
});
