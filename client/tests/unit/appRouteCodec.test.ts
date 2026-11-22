import { describe, expect, it } from "vitest";
import {
  createInitialAppRoute,
  appRouteCodec,
  type AppRoute,
} from "../../src/entities/navigation/model/appRoute";

const BASE_ROUTE = createInitialAppRoute();

function roundTrip(route: AppRoute, base: AppRoute = BASE_ROUTE): AppRoute {
  const { url, entryState } = appRouteCodec.serialize(route);
  return appRouteCodec.parse(url, structuredClone(entryState)).apply(base);
}

const libraryRoute: AppRoute = {
  ...BASE_ROUTE,
  mode: "library",
  library: {
    ...BASE_ROUTE.library,
    selectedTags: ["cv/水瀬なずな"],
    selectedWorkId: "RJ01234567",
    sort: "title-asc",
    groupSort: "name-desc",
    seed: 4242,
  },
  layer: { kind: "nowPlaying", openedBy: "app" },
};

describe("appRouteCodec", () => {
  it("sort・groupSort・seed は URL に出さず、層は np=1 で表し、履歴エントリーの状態に書く", () => {
    const { url, entryState } = appRouteCodec.serialize(libraryRoute);

    expect(url).not.toMatch(/sort|seed/);
    expect(url).toMatch(/[?&]np=1$/);
    expect(entryState).toEqual({
      sort: "title-asc",
      groupSort: "name-desc",
      seed: 4242,
      layer: { kind: "nowPlaying", openedBy: "app" },
    });
  });

  it("作品詳細・ファイルのエントリーには sort・seed を書かない", () => {
    const layer = libraryRoute.layer;
    expect(appRouteCodec.serialize({ ...libraryRoute, mode: "files" }).entryState).toEqual({
      layer,
    });
    expect(
      appRouteCodec.serialize({ ...libraryRoute, mode: "workDetail", workId: "RJ01234567" })
        .entryState,
    ).toEqual({ layer });
  });

  it("URL と履歴エントリーの状態から同じ route を読み戻す", () => {
    expect(roundTrip(libraryRoute)).toEqual(libraryRoute);
  });

  it("作品詳細・ファイルのエントリーでは sort・seed を読み戻さず現在値を保ち、層は URL の np から読む", () => {
    const current: AppRoute = {
      ...libraryRoute,
      library: { ...libraryRoute.library, sort: "added-asc", groupSort: "count-asc", seed: 7 },
      layer: null,
    };
    const entryState = {
      sort: "title-asc",
      groupSort: "name-desc",
      seed: 4242,
      layer: libraryRoute.layer,
    };

    for (const url of ["/work/RJ99999999?np=1", "/files/dlsite?np=1"]) {
      const restored = appRouteCodec.parse(url, entryState).apply(current);
      expect(restored.library).toMatchObject({
        sort: "added-asc",
        groupSort: "count-asc",
        seed: 7,
      });
      expect(restored.layer).toEqual(libraryRoute.layer);
    }
  });

  it("履歴エントリーの groupSort は null を含め読み戻し、読めない値なら現在値を保つ", () => {
    const groupSortOf = (groupSort: unknown) =>
      appRouteCodec.parse("/library/all", { sort: null, groupSort, seed: 1 }).apply(libraryRoute)
        .library.groupSort;

    expect(groupSortOf("last-played")).toBe("last-played");
    expect(groupSortOf(null)).toBeNull();
    for (const invalid of ["name", "random", 1]) expect(groupSortOf(invalid)).toBe("name-desc");
  });

  it("履歴エントリーの seed がサーバー契約の範囲（0〜0x7fffffff の整数）外なら現在値を保つ", () => {
    const seedOf = (seed: unknown) =>
      appRouteCodec.parse("/library/all", { sort: null, seed }).apply(libraryRoute).library.seed;

    expect(seedOf(0)).toBe(0);
    expect(seedOf(0x7fffffff)).toBe(0x7fffffff);
    for (const seed of [-1, 0x80000000, 1.5, "7", null]) expect(seedOf(seed)).toBe(4242);
  });

  it("URL に np=1 が無ければ、履歴エントリーの状態に層が書かれていても開かない", () => {
    const entryState = { sort: null, seed: 1, layer: libraryRoute.layer };
    expect(appRouteCodec.parse("/library/all", entryState).apply(libraryRoute).layer).toBeNull();
  });

  it("開き方は履歴エントリーの状態から読み、無ければ URL を直接開いたものとして扱う", () => {
    const opened = (entryState: unknown) =>
      appRouteCodec.parse("/library/all?np=1", entryState).apply(BASE_ROUTE).layer;

    expect(opened({ layer: { kind: "nowPlaying", openedBy: "app" } })).toEqual({
      kind: "nowPlaying",
      openedBy: "app",
    });
    expect(opened(undefined)).toEqual({ kind: "nowPlaying", openedBy: "url" });
    expect(opened({ layer: { kind: "nowPlaying", openedBy: "x" } })).toEqual({
      kind: "nowPlaying",
      openedBy: "url",
    });
  });

  it("ライブラリ(X) → 作品詳細 → 戻る → 並びをYへ変更 → 進む → 戻る、でYが保たれる", () => {
    const staleDetailEntry = { sort: "title-asc", seed: 4242, layer: null };
    const changed: AppRoute = {
      ...libraryRoute,
      layer: null,
      library: { ...libraryRoute.library, sort: "added-asc" },
    };

    const detail = appRouteCodec.parse("/work/RJ01", staleDetailEntry).apply(changed);
    expect(detail.mode).toBe("workDetail");
    expect(detail.library.sort).toBe("added-asc");

    const { url, entryState } = appRouteCodec.serialize(changed);
    const back = appRouteCodec.parse(url, entryState).apply(detail);
    expect(back.mode).toBe("library");
    expect(back.library.sort).toBe("added-asc");
  });

  it("sort が null（既定）も往復する", () => {
    const route: AppRoute = { ...libraryRoute, library: { ...libraryRoute.library, sort: null } };
    expect(roundTrip(route).library.sort).toBeNull();
  });

  it("履歴エントリーの状態が無ければ、現在の seed と並びを保つ", () => {
    const current: AppRoute = { ...libraryRoute, layer: null };
    const restored = appRouteCodec.parse("/library/all", undefined).apply(current);
    expect(restored.library).toMatchObject({ sort: "title-asc", seed: 4242 });
  });

  it("読めない項目は現在の値を保つ", () => {
    const restored = appRouteCodec
      .parse("/library/all?np=1", { sort: "nope", seed: "x", layer: { kind: "other" } })
      .apply(libraryRoute);
    expect(restored.library).toMatchObject({ sort: "title-asc", seed: 4242 });
    expect(restored.layer).toEqual({ kind: "nowPlaying", openedBy: "url" });
  });
});
