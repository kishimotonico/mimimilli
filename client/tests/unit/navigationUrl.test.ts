import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIBRARY_URL_STATE,
  parseNavigationUrl,
  serializeNavigationUrl,
  type NavigationUrlState,
} from "../../src/entities/navigation/model/navigationUrl";

describe("navigation URL codec", () => {
  it("round-trips a Japanese library axis with a tag filter and work", () => {
    const state: NavigationUrlState = {
      mode: "library",
      np: false,
      library: {
        ...DEFAULT_LIBRARY_URL_STATE,
        folderId: "all",
        selectedTags: ["cv/水瀬なずな"],
        selectedWorkId: "RJ01234567",
      },
    };

    const url = serializeNavigationUrl(state);
    expect(url).toBe(
      "/library/all?tags=cv%2F%E6%B0%B4%E7%80%AC%E3%81%AA%E3%81%9A%E3%81%AA&work=RJ01234567",
    );
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("preserves multiple Japanese tags without comma ambiguity", () => {
    const state: NavigationUrlState = {
      mode: "library",
      np: false,
      library: {
        ...DEFAULT_LIBRARY_URL_STATE,
        folderId: "all",
        selectedTags: ["ASMR", "癒し系"],
      },
    };

    const url = serializeNavigationUrl(state);
    expect(url).toBe("/library/all?tags=ASMR&tags=%E7%99%92%E3%81%97%E7%B3%BB");
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("keeps a tag filter on the all folder", () => {
    const state: NavigationUrlState = {
      mode: "library",
      np: false,
      library: { ...DEFAULT_LIBRARY_URL_STATE, folderId: "all", selectedTags: ["ASMR"] },
    };

    const url = serializeNavigationUrl(state);
    expect(url).toBe("/library/all?tags=ASMR");
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("round-trips a year pseudo-tag filter as the reserved @ form (ADR-0012 §2)", () => {
    const state: NavigationUrlState = {
      mode: "library",
      np: false,
      library: { ...DEFAULT_LIBRARY_URL_STATE, folderId: "all", selectedTags: ["@year/2024"] },
    };

    const url = serializeNavigationUrl(state);
    expect(url).toBe("/library/all?tags=%40year%2F2024");
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("round-trips a real tag literally named year/2025 distinctly from the pseudo-tag form", () => {
    const state: NavigationUrlState = {
      mode: "library",
      np: false,
      library: { ...DEFAULT_LIBRARY_URL_STATE, folderId: "all", selectedTags: ["year/2025"] },
    };

    const url = serializeNavigationUrl(state);
    expect(url).toBe("/library/all?tags=year%2F2025");
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("round-trips smart folder IDs", () => {
    const state: NavigationUrlState = {
      mode: "library",
      np: false,
      library: { ...DEFAULT_LIBRARY_URL_STATE, folderId: "sf-1234" },
    };

    expect(parseNavigationUrl(serializeNavigationUrl(state))).toMatchObject({
      state,
      warnings: [],
    });
  });

  it("ignores sort= in the URL, since sort lives in the history entry state", () => {
    const result = parseNavigationUrl("/library/all?sort=title-asc");

    expect(result.state).toEqual({
      mode: "library",
      library: DEFAULT_LIBRARY_URL_STATE,
      np: false,
    });
    expect(result.canonicalUrl).toBe("/library/all");
    expect(result.warnings).toEqual([]);
  });

  it("does not drop tags= and q= at parse time even for a grouped folder (resolveLibraryView ignores them)", () => {
    const result = parseNavigationUrl("/library/by-cv?tags=cv%2F%E8%97%A4%E7%94%B0%E8%8C%9C&q=foo");
    expect(result.state).toMatchObject({
      mode: "library",
      np: false,
      library: { folderId: "by-cv", group: null, selectedTags: ["cv/藤田茜"], q: "foo" },
    });
    expect(result.canonicalUrl).toBe("/library/by-cv?tags=cv%2F%E8%97%A4%E7%94%B0%E8%8C%9C&q=foo");
  });

  it("keeps tags= and q= for a folder URL", () => {
    const result = parseNavigationUrl("/library/sf-1?tags=ASMR&q=foo");
    expect(result.state).toMatchObject({
      mode: "library",
      np: false,
      library: { folderId: "sf-1", selectedTags: ["ASMR"], q: "foo" },
    });
  });

  it("round-trips a group value via ?group= placed before tags", () => {
    const state: NavigationUrlState = {
      mode: "library",
      np: false,
      library: {
        ...DEFAULT_LIBRARY_URL_STATE,
        folderId: "by-cv",
        group: "水瀬なずな",
        selectedTags: ["ASMR"],
      },
    };
    const url = serializeNavigationUrl(state);
    expect(url).toBe(
      "/library/by-cv?group=%E6%B0%B4%E7%80%AC%E3%81%AA%E3%81%9A%E3%81%AA&tags=ASMR",
    );
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("keeps a tag-kind group value containing slashes", () => {
    const state: NavigationUrlState = {
      mode: "library",
      np: false,
      library: { ...DEFAULT_LIBRARY_URL_STATE, folderId: "by-tag", group: "cv/藤田茜" },
    };
    expect(parseNavigationUrl(serializeNavigationUrl(state))).toMatchObject({
      state,
      warnings: [],
    });
  });

  it("round-trips file segments and a root-relative selection", () => {
    const state: NavigationUrlState = {
      mode: "files",
      np: false,
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
      state: { mode: "library", library: DEFAULT_LIBRARY_URL_STATE, np: false },
      canonicalUrl: "/library/all",
      warnings: [],
    });
  });

  it("accepts any folder ID segment without validating existence (not lowercased)", () => {
    const result = parseNavigationUrl("/library/%E6%B0%97%E5%88%86");
    expect(result.state).toEqual({
      mode: "library",
      np: false,
      library: { ...DEFAULT_LIBRARY_URL_STATE, folderId: "気分" },
    });
    expect(result.warnings).toEqual([]);

    expect(parseNavigationUrl("/library/CV").state).toMatchObject({ library: { folderId: "CV" } });
  });

  it("rejects a third path segment", () => {
    const result = parseNavigationUrl("/library/fav/value");
    expect(result.state).toEqual({
      mode: "library",
      np: false,
      library: DEFAULT_LIBRARY_URL_STATE,
    });
    expect(result.warnings[0]).toContain("スマートフォルダーの階層として不正な URL");
  });

  it("rejects paths that can escape or impersonate the configured root", () => {
    const pathResult = parseNavigationUrl("/files/%2Fetc/passwd");
    expect(pathResult.state).toEqual({
      mode: "library",
      np: false,
      library: DEFAULT_LIBRARY_URL_STATE,
    });
    expect(pathResult.warnings[0]).toContain("安全でないパス segment");

    const selectionResult = parseNavigationUrl("/files/library?sel=%2Fetc%2Fpasswd");
    expect(selectionResult.state).toEqual({
      mode: "files",
      np: false,
      files: { relPath: ["library"], selectedRelPath: null },
    });
    expect(selectionResult.warnings).toEqual([
      "root 相対でない選択パスを拒否しました: /etc/passwd",
    ]);
  });

  it("round-trips a search query via q=", () => {
    const state: NavigationUrlState = {
      mode: "library",
      np: false,
      library: { ...DEFAULT_LIBRARY_URL_STATE, q: "耳かき ASMR" },
    };

    const url = serializeNavigationUrl(state);
    expect(url).toBe("/library/all?q=%E8%80%B3%E3%81%8B%E3%81%8D+ASMR");
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("omits q from the URL when empty", () => {
    const url = serializeNavigationUrl({
      mode: "library",
      np: false,
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
      np: false,
      library: { ...DEFAULT_LIBRARY_URL_STATE, folderId: "all", selectedTags: ["cv/藤田茜"] },
    });
    expect(result.warnings[0]).toContain("選択タグを検証しました");
    expect(result.warnings[0]).toContain("@unknown/2024");
  });

  it("normalizes multiple year pseudo-tags to the first one with a warning, matching the single-selection UI constraint", () => {
    const result = parseNavigationUrl("/library/all?tags=%40year%2F2023&tags=%40year%2F2024");

    expect(result.state).toEqual({
      mode: "library",
      np: false,
      library: { ...DEFAULT_LIBRARY_URL_STATE, folderId: "all", selectedTags: ["@year/2023"] },
    });
    expect(result.warnings[0]).toContain("選択タグを検証しました");
    expect(result.warnings[0]).toContain("@year/2024");
  });

  it("round-trips the full-screen work detail route", () => {
    const state: NavigationUrlState = { mode: "workDetail", workId: "RJ01234567", np: false };

    const url = serializeNavigationUrl(state);
    expect(url).toBe("/work/RJ01234567");
    expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
  });

  it("rejects a work detail URL missing the work id", () => {
    const result = parseNavigationUrl("/work");

    expect(result.state).toEqual({
      mode: "library",
      np: false,
      library: DEFAULT_LIBRARY_URL_STATE,
    });
    expect(result.warnings[0]).toContain("作品詳細の階層として不正な URL");
  });

  it("再生中の層は、下の画面の URL に np=1 を足して表す", () => {
    const cases: [NavigationUrlState, string][] = [
      [
        {
          mode: "library",
          np: true,
          library: { ...DEFAULT_LIBRARY_URL_STATE, folderId: "fav" },
        },
        "/library/fav?np=1",
      ],
      [{ mode: "workDetail", workId: "RJ01234567", np: true }, "/work/RJ01234567?np=1"],
      [
        { mode: "files", np: true, files: { relPath: ["ASMR"], selectedRelPath: null } },
        "/files/ASMR?np=1",
      ],
    ];
    for (const [state, url] of cases) {
      expect(serializeNavigationUrl(state)).toBe(url);
      expect(parseNavigationUrl(url)).toMatchObject({ state, warnings: [] });
    }
  });

  it("np は他のクエリと並べて書き、np=1 以外は層を開かない", () => {
    expect(
      serializeNavigationUrl({
        mode: "library",
        np: true,
        library: { ...DEFAULT_LIBRARY_URL_STATE, folderId: "all", selectedTags: ["ASMR"] },
      }),
    ).toBe("/library/all?tags=ASMR&np=1");
    expect(parseNavigationUrl("/library/all?np=0").state.np).toBe(false);
  });

  it("/now-playing は存在しない画面として扱い、ライブラリへ戻す", () => {
    const result = parseNavigationUrl("/now-playing");
    expect(result.state).toMatchObject({ mode: "library", np: false });
    expect(result.warnings).toHaveLength(1);
  });
});
