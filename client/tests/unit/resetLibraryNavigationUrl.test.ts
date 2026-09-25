import { describe, expect, it } from "vitest";
import { computeResetNavigationUrl } from "../../src/app/model/resetLibraryNavigationUrl";

describe("computeResetNavigationUrl", () => {
  it("ルート以外のURLはルートへreplaceする", () => {
    expect(computeResetNavigationUrl("http://localhost/library/cv?q=foo&tags=bar")).toBe("/");
    expect(computeResetNavigationUrl("http://localhost/files/dlsite")).toBe("/");
    expect(computeResetNavigationUrl("http://localhost/now-playing")).toBe("/");
    expect(computeResetNavigationUrl("http://localhost/work/work-1")).toBe("/");
  });

  it("既にルートならnull（変更不要）", () => {
    expect(computeResetNavigationUrl("http://localhost/")).toBeNull();
  });
});
