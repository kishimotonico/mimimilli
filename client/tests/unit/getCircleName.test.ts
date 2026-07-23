import { describe, expect, it } from "vitest";
import { getCircleName } from "../../src/entities/work/model";

describe("getCircleName", () => {
  it("circleName が指定されていればそれをそのまま返す", () => {
    expect(getCircleName({ circleName: "夜想曲" })).toBe("夜想曲");
    expect(getCircleName({ circleName: null })).toBeNull();
  });

  it("tags のみの場合、複数サークルタグがあれば UTF-8 バイト順の先頭を採用する（shared と同一ロジック）", () => {
    expect(getCircleName({ tags: ["サークル/和風", "circle/Zeta", "circle/Alpha", "ASMR"] })).toBe(
      "Alpha",
    );
  });

  it("サークルタグが無ければ null を返す", () => {
    expect(getCircleName({ tags: ["ASMR", "バイノーラル"] })).toBeNull();
  });

  it("tags も circleName も無ければ null を返す", () => {
    expect(getCircleName({})).toBeNull();
  });
});
