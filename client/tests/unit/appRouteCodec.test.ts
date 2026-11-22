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
    seed: 4242,
  },
  layer: { kind: "nowPlaying", openedBy: "app" },
};

describe("appRouteCodec", () => {
  it("sort・seed・layer は URL に出さず、履歴エントリーの状態に書く", () => {
    const { url, entryState } = appRouteCodec.serialize(libraryRoute);

    expect(url).not.toMatch(/sort|seed/);
    expect(entryState).toEqual({
      sort: "title-asc",
      seed: 4242,
      layer: { kind: "nowPlaying", openedBy: "app" },
    });
  });

  it("URL と履歴エントリーの状態から同じ route を読み戻す", () => {
    expect(roundTrip(libraryRoute)).toEqual(libraryRoute);
  });

  it("作品詳細・ファイルのエントリーでは sort・seed を読み戻さず現在値を保ち、layer は読む", () => {
    const current: AppRoute = {
      ...libraryRoute,
      library: { ...libraryRoute.library, sort: "added-asc", seed: 7 },
      layer: null,
    };
    const entryState = { sort: "title-asc", seed: 4242, layer: libraryRoute.layer };

    for (const url of ["/work/RJ99999999", "/files/dlsite"]) {
      const restored = appRouteCodec.parse(url, entryState).apply(current);
      expect(restored.library).toMatchObject({ sort: "added-asc", seed: 7 });
      expect(restored.layer).toEqual(libraryRoute.layer);
    }
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
      .parse("/library/all", { sort: "nope", seed: "x", layer: { kind: "other" } })
      .apply(libraryRoute);
    expect(restored.library).toMatchObject({ sort: "title-asc", seed: 4242 });
    expect(restored.layer).toEqual(libraryRoute.layer);
  });
});
