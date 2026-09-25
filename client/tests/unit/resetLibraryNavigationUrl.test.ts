import { describe, expect, it } from "vitest";
import { computeResetLibraryUrl } from "../../src/app/model/resetLibraryNavigationUrl";

describe("computeResetLibraryUrl", () => {
  it("libraryモードで絞り込み・検索語・選択作品が残っていれば既定値へ戻したURLを返す", () => {
    const next = computeResetLibraryUrl("http://localhost/library/cv?q=foo&tags=bar&work=work-1");
    expect(next).not.toBeNull();
    expect(next).toBe("/library/all");
  });

  it("sortは現在の値を維持する", () => {
    const next = computeResetLibraryUrl("http://localhost/library/all?q=foo&sort=random");
    expect(next).not.toBeNull();
    const parsedNext = new URL(next!, "http://localhost");
    expect(parsedNext.searchParams.get("sort")).toBe("random");
    expect(parsedNext.searchParams.get("q")).toBeNull();
  });

  it("既にlibraryの既定値ならnull（変更不要）", () => {
    expect(computeResetLibraryUrl("http://localhost/")).toBeNull();
    expect(computeResetLibraryUrl("http://localhost/library/all")).toBeNull();
  });

  it("libraryモード以外はnull", () => {
    expect(computeResetLibraryUrl("http://localhost/files/dlsite")).toBeNull();
    expect(computeResetLibraryUrl("http://localhost/now-playing")).toBeNull();
  });
});
