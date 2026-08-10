import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIBRARY_URL_STATE,
  parseNavigationUrl,
  serializeNavigationUrl,
  type NavigationUrlState,
} from "../../src/entities/library/model/navigationUrl";

describe("navigation URL codec", () => {
  it("round-trips a Japanese library axis with a tag filter, work, and sort", () => {
    const state: NavigationUrlState = {
      mode: "library",
      library: {
        ...DEFAULT_LIBRARY_URL_STATE,
        activeAxis: "cv",
        selectedTags: ["cv/水瀬なずな"],
        selectedWorkId: "RJ01234567",
        sort: "title-asc",
      },
    };

    const url = serializeNavigationUrl(state);
    expect(url).toBe(
      "/library/cv?tags=cv%2F%E6%B0%B4%E7%80%AC%E3%81%AA%E3%81%9A%E3%81%AA&work=RJ01234567&sort=title-asc",
    );
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("preserves multiple Japanese tags without comma ambiguity", () => {
    const state: NavigationUrlState = {
      mode: "library",
      library: {
        ...DEFAULT_LIBRARY_URL_STATE,
        activeAxis: "tag",
        selectedTags: ["ASMR", "癒し系"],
      },
    };

    const url = serializeNavigationUrl(state);
    expect(url).toBe("/library/tag?tags=ASMR&tags=%E7%99%92%E3%81%97%E7%B3%BB");
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("carries a tag filter over even on a view axis (ADR-0012: filters apply across all axes)", () => {
    const state: NavigationUrlState = {
      mode: "library",
      library: { ...DEFAULT_LIBRARY_URL_STATE, activeAxis: "all", selectedTags: ["ASMR"] },
    };

    const url = serializeNavigationUrl(state);
    expect(url).toBe("/library/all?tags=ASMR");
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("round-trips a year pseudo-tag filter as the reserved @ form (ADR-0012 §2)", () => {
    const state: NavigationUrlState = {
      mode: "library",
      library: { ...DEFAULT_LIBRARY_URL_STATE, activeAxis: "year", selectedTags: ["@year/2024"] },
    };

    const url = serializeNavigationUrl(state);
    expect(url).toBe("/library/year?tags=%40year%2F2024");
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("round-trips a real tag literally named year/2025 distinctly from the pseudo-tag form", () => {
    const state: NavigationUrlState = {
      mode: "library",
      library: { ...DEFAULT_LIBRARY_URL_STATE, activeAxis: "tag", selectedTags: ["year/2025"] },
    };

    const url = serializeNavigationUrl(state);
    expect(url).toBe("/library/tag?tags=year%2F2025");
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("round-trips smart folder IDs", () => {
    const state: NavigationUrlState = {
      mode: "library",
      library: { ...DEFAULT_LIBRARY_URL_STATE, activeAxis: "smart-sleep-long" },
    };

    expect(parseNavigationUrl(serializeNavigationUrl(state))).toMatchObject({
      state,
      warnings: [],
    });
  });

  it("round-trips file segments and a root-relative selection", () => {
    const state: NavigationUrlState = {
      mode: "files",
      files: {
        relPath: ["ASMR", "2026年"],
        selectedRelPath: ["ASMR", "2026年", "作品01.flac"],
      },
    };

    expect(parseNavigationUrl(serializeNavigationUrl(state))).toMatchObject({
      state,
      warnings: [],
    });
  });

  it("canonicalizes the root URL to the default library view", () => {
    expect(parseNavigationUrl("/")).toEqual({
      state: { mode: "library", library: DEFAULT_LIBRARY_URL_STATE },
      canonicalUrl: "/library/all",
      warnings: [],
    });
  });

  it("accepts arbitrary prefix segments as facet axes (lowercased)", () => {
    // ADR-0005: 予約ID以外のセグメントは prefix 軸として受理する
    const result = parseNavigationUrl("/library/%E6%B0%97%E5%88%86");
    expect(result.state).toEqual({
      mode: "library",
      library: { ...DEFAULT_LIBRARY_URL_STATE, activeAxis: "気分" },
    });
    expect(result.warnings).toEqual([]);

    const upper = parseNavigationUrl("/library/CV");
    expect(upper.state).toMatchObject({ library: { activeAxis: "cv" } });
  });

  it("warns and falls back for a bare smart- axis", () => {
    const result = parseNavigationUrl("/library/smart-?work=ignored");

    expect(result.state).toEqual({
      mode: "library",
      library: DEFAULT_LIBRARY_URL_STATE,
    });
    expect(result.canonicalUrl).toBe("/library/all");
    expect(result.warnings).toEqual(["存在しないライブラリ軸を拒否しました: smart-"]);
  });

  it("rejects a drillValue-style third path segment (drill segment abolished, ADR-0012 §2)", () => {
    const result = parseNavigationUrl("/library/fav/value");
    expect(result.state).toEqual({
      mode: "library",
      library: DEFAULT_LIBRARY_URL_STATE,
    });
    expect(result.warnings[0]).toContain("軸の階層として不正な URL");
  });

  it("rejects paths that can escape or impersonate the configured root", () => {
    const pathResult = parseNavigationUrl("/files/%2Fetc/passwd");
    expect(pathResult.state).toEqual({
      mode: "library",
      library: DEFAULT_LIBRARY_URL_STATE,
    });
    expect(pathResult.warnings[0]).toContain("安全でないパス segment");

    const selectionResult = parseNavigationUrl("/files/library?sel=%2Fetc%2Fpasswd");
    expect(selectionResult.state).toEqual({
      mode: "files",
      files: { relPath: ["library"], selectedRelPath: null },
    });
    expect(selectionResult.warnings).toEqual([
      "root 相対でない選択パスを拒否しました: /etc/passwd",
    ]);
  });

  it("round-trips a search query via q=", () => {
    const state: NavigationUrlState = {
      mode: "library",
      library: { ...DEFAULT_LIBRARY_URL_STATE, q: "耳かき ASMR" },
    };

    const url = serializeNavigationUrl(state);
    expect(url).toBe("/library/all?q=%E8%80%B3%E3%81%8B%E3%81%8D+ASMR");
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("omits q from the URL when empty", () => {
    const url = serializeNavigationUrl({
      mode: "library",
      library: { ...DEFAULT_LIBRARY_URL_STATE, q: "" },
    });
    expect(url).toBe("/library/all");
  });

  it("rejects an unknown builtin-axis pseudo-tag with a warning instead of leaving a dead chip (ADR-0012 §2)", () => {
    const result = parseNavigationUrl(
      "/library/all?tags=%40unknown%2F2024&tags=cv%2F%E8%97%A4%E7%94%B0%E8%8C%9C",
    );

    expect(result.state).toEqual({
      mode: "library",
      library: { ...DEFAULT_LIBRARY_URL_STATE, activeAxis: "all", selectedTags: ["cv/藤田茜"] },
    });
    expect(result.warnings[0]).toContain("選択タグを検証しました");
    expect(result.warnings[0]).toContain("@unknown/2024");
  });

  it("normalizes multiple year pseudo-tags to the first one with a warning, matching the single-selection UI constraint", () => {
    const result = parseNavigationUrl("/library/year?tags=%40year%2F2023&tags=%40year%2F2024");

    expect(result.state).toEqual({
      mode: "library",
      library: { ...DEFAULT_LIBRARY_URL_STATE, activeAxis: "year", selectedTags: ["@year/2023"] },
    });
    expect(result.warnings[0]).toContain("選択タグを検証しました");
    expect(result.warnings[0]).toContain("@year/2024");
  });

  it("warns and restores the default sort for an invalid value", () => {
    const result = parseNavigationUrl("/library/all?sort=nope");

    expect(result.state).toEqual({
      mode: "library",
      library: DEFAULT_LIBRARY_URL_STATE,
    });
    expect(result.warnings).toEqual(["存在しない sort を既定値へ戻しました: nope"]);
  });
});
