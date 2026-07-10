import { describe, expect, it } from "vitest";
import { buildEmptyWorksMessage } from "../../src/features/library/model/emptyWorks";

describe("buildEmptyWorksMessage", () => {
  it("shows a generic message when nothing narrows the result", () => {
    expect(buildEmptyWorksMessage("", null, null)).toBe("作品が見つかりません");
  });

  it("mentions the search query alone", () => {
    expect(buildEmptyWorksMessage("癒し", null, null)).toBe("「癒し」に一致する作品はありません");
  });

  it("mentions the drill axis/value alone", () => {
    expect(buildEmptyWorksMessage("", "circle", "月白製作所")).toBe(
      "サークル「月白製作所」 に一致する作品はありません",
    );
  });

  it("combines search query and drill when both narrow the result", () => {
    expect(buildEmptyWorksMessage("癒し", "circle", "月白製作所")).toBe(
      "「癒し」・サークル「月白製作所」 に一致する作品はありません",
    );
  });
});
