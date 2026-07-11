import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIBRARY_URL_STATE,
  parseNavigationUrl,
  serializeNavigationUrl,
  type NavigationUrlState,
} from "../../src/features/navigation/model/navigationUrl";

describe("navigation URL codec", () => {
  it("round-trips a Japanese library drill with work and sort", () => {
    const state: NavigationUrlState = {
      mode: "library",
      library: {
        ...DEFAULT_LIBRARY_URL_STATE,
        activeAxis: "cv",
        drillValue: "水瀬なずな",
        selectedWorkId: "RJ01234567",
        sort: "title-asc",
      },
    };

    const url = serializeNavigationUrl(state);
    expect(url).toBe(
      "/library/cv/%E6%B0%B4%E7%80%AC%E3%81%AA%E3%81%9A%E3%81%AA?work=RJ01234567&sort=title-asc",
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

  it("round-trips smart folder IDs", () => {
    const state: NavigationUrlState = {
      mode: "library",
      library: {
        ...DEFAULT_LIBRARY_URL_STATE,
        activeAxis: "smart-sleep-long",
      },
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
    const result = parseNavigationUrl("/library/%E6%B0%97%E5%88%86/%E7%9D%A1%E7%9C%A0%E7%94%A8");
    expect(result.state).toEqual({
      mode: "library",
      library: {
        ...DEFAULT_LIBRARY_URL_STATE,
        activeAxis: "気分",
        drillValue: "睡眠用",
      },
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

  it("rejects drill values on non-drillable axes (view / tag)", () => {
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

  it("warns and restores the default sort for an invalid value", () => {
    const result = parseNavigationUrl("/library/all?sort=nope");

    expect(result.state).toEqual({
      mode: "library",
      library: DEFAULT_LIBRARY_URL_STATE,
    });
    expect(result.warnings).toEqual(["存在しない sort を既定値へ戻しました: nope"]);
  });
});
