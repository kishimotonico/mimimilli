import { describe, expect, it } from "vitest";
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

describe("buildEmptyWorksHint", () => {
  it("adds context for fav view when not filtered", () => {
    expect(buildEmptyWorksHint("fav", false)).toBe("作品詳細の☆ボタンでお気に入りに追加できます");
  });

  it("adds context for error view when not filtered", () => {
    expect(buildEmptyWorksHint("error", false)).toBe(
      "元ファイルが見つからない・メタデータの読み込みに失敗した作品はここに表示されます",
    );
  });

  it("omits hint when the empty state is due to a filter (search/tags)", () => {
    expect(buildEmptyWorksHint("fav", true)).toBeUndefined();
    expect(buildEmptyWorksHint("error", true)).toBeUndefined();
  });

  it("omits hint for axes without a specific context", () => {
    expect(buildEmptyWorksHint("all", false)).toBeUndefined();
  });
});
