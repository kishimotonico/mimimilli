import { describe, expect, it } from "vitest";
import type { TagPrefix } from "@mimimilli/shared";
import {
  buildEmptyWorksHint,
  buildEmptyWorksMessage,
} from "../../src/features/library/model/emptyWorks";

const PREFIXES: TagPrefix[] = [
  { prefix: "サークル", label: "サークル", color: null, showAsAxis: true, protected: true },
];

describe("buildEmptyWorksMessage", () => {
  it("shows a generic message when nothing narrows the result", () => {
    expect(buildEmptyWorksMessage("", null, null)).toBe("作品が見つかりません");
  });

  it("mentions the search query alone", () => {
    expect(buildEmptyWorksMessage("癒し", null, null)).toBe("「癒し」に一致する作品はありません");
  });

  it("mentions the drill axis/value alone", () => {
    expect(buildEmptyWorksMessage("", "サークル", "月白製作所", PREFIXES)).toBe(
      "サークル「月白製作所」 に一致する作品はありません",
    );
  });

  it("combines search query and drill when both narrow the result", () => {
    expect(buildEmptyWorksMessage("癒し", "サークル", "月白製作所", PREFIXES)).toBe(
      "「癒し」・サークル「月白製作所」 に一致する作品はありません",
    );
  });
});

describe("buildEmptyWorksHint", () => {
  it("adds context for fav view when not filtered", () => {
    expect(buildEmptyWorksHint("fav", false)).toBe("作品詳細の☆ボタンでお気に入りに追加できます");
  });

  it("adds context for missing view when not filtered", () => {
    expect(buildEmptyWorksHint("missing", false)).toBe(
      "元ファイルが見つからない作品はここに表示されます",
    );
  });

  it("omits hint when the empty state is due to a filter (search/drill)", () => {
    expect(buildEmptyWorksHint("fav", true)).toBeUndefined();
    expect(buildEmptyWorksHint("missing", true)).toBeUndefined();
  });

  it("omits hint for axes without a specific context", () => {
    expect(buildEmptyWorksHint("all", false)).toBeUndefined();
  });
});
