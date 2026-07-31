import { describe, expect, it } from "vitest";
import {
  getWorkPatchInvalidationTargets,
  type LibraryListContext,
} from "../../src/features/library/model/workPatchInvalidation";

const baseCtx: LibraryListContext = {
  activeAxis: "all",
  sort: "added-desc",
  searchQuery: "",
  selectedTags: [],
  drillValue: null,
};

describe("getWorkPatchInvalidationTargets", () => {
  it("タイトル変更（all軸・非タイトルソート）ではアクティブ一覧のみ直接更新し非表示は stale 化", () => {
    expect(getWorkPatchInvalidationTargets({ title: "新しいタイトル" }, baseCtx)).toEqual({
      facets: false,
      tags: false,
      resetActiveWorksList: false,
      patchActiveListCache: true,
      staleInactiveListCaches: true,
    });
  });

  it("タイトル変更（title-asc ソート中）はアクティブ一覧を reset", () => {
    expect(
      getWorkPatchInvalidationTargets(
        { title: "新しいタイトル" },
        { ...baseCtx, sort: "title-asc" },
      ),
    ).toEqual({
      facets: false,
      tags: false,
      resetActiveWorksList: true,
      patchActiveListCache: false,
      staleInactiveListCaches: true,
    });
  });

  it("タイトル変更（検索中）はアクティブ一覧を reset", () => {
    expect(
      getWorkPatchInvalidationTargets(
        { title: "新しいタイトル" },
        { ...baseCtx, searchQuery: "ASMR" },
      ),
    ).toEqual({
      facets: false,
      tags: false,
      resetActiveWorksList: true,
      patchActiveListCache: false,
      staleInactiveListCaches: true,
    });
  });

  it("タグ変更（all軸）では facets/tags とアクティブ直接更新・非表示 stale 化", () => {
    expect(getWorkPatchInvalidationTargets({ tags: ["ASMR"] }, baseCtx)).toEqual({
      facets: true,
      tags: true,
      resetActiveWorksList: false,
      patchActiveListCache: true,
      staleInactiveListCaches: true,
    });
  });

  it("タグ変更（検索中）はアクティブ reset", () => {
    expect(
      getWorkPatchInvalidationTargets({ tags: ["ASMR"] }, { ...baseCtx, searchQuery: "ASMR" }),
    ).toEqual({
      facets: true,
      tags: true,
      resetActiveWorksList: true,
      patchActiveListCache: false,
      staleInactiveListCaches: true,
    });
  });

  it("タグ変更（タグフィルタ中）はアクティブ reset", () => {
    expect(
      getWorkPatchInvalidationTargets(
        { tags: ["ASMR"] },
        { ...baseCtx, activeAxis: "tag", selectedTags: ["ASMR"] },
      ),
    ).toEqual({
      facets: true,
      tags: true,
      resetActiveWorksList: true,
      patchActiveListCache: false,
      staleInactiveListCaches: true,
    });
  });

  it("タグ変更（ファセットドリル中）はアクティブ reset", () => {
    expect(
      getWorkPatchInvalidationTargets(
        { tags: ["cv/水瀬なずな"] },
        { ...baseCtx, activeAxis: "cv", drillValue: "水瀬なずな" },
      ),
    ).toEqual({
      facets: true,
      tags: true,
      resetActiveWorksList: true,
      patchActiveListCache: false,
      staleInactiveListCaches: true,
    });
  });

  it("ブックマーク変更（fav ビュー以外）ではアクティブ直接更新と非表示 stale 化", () => {
    expect(getWorkPatchInvalidationTargets({ bookmarked: true }, baseCtx)).toEqual({
      facets: false,
      tags: false,
      resetActiveWorksList: false,
      patchActiveListCache: true,
      staleInactiveListCaches: true,
    });
  });

  it("ブックマーク変更（fav ビュー）ではアクティブ reset", () => {
    expect(
      getWorkPatchInvalidationTargets({ bookmarked: true }, { ...baseCtx, activeAxis: "fav" }),
    ).toEqual({
      facets: false,
      tags: false,
      resetActiveWorksList: true,
      patchActiveListCache: false,
      staleInactiveListCaches: true,
    });
  });

  it("スマート軸表示中の title/tags/bookmarked 変更は保守的にアクティブ reset", () => {
    const smartCtx = { ...baseCtx, activeAxis: "smart-sf-1" };
    expect(getWorkPatchInvalidationTargets({ title: "新タイトル" }, smartCtx)).toEqual({
      facets: false,
      tags: false,
      resetActiveWorksList: true,
      patchActiveListCache: false,
      staleInactiveListCaches: true,
    });
    expect(getWorkPatchInvalidationTargets({ tags: ["ASMR"] }, smartCtx)).toEqual({
      facets: true,
      tags: true,
      resetActiveWorksList: true,
      patchActiveListCache: false,
      staleInactiveListCaches: true,
    });
    expect(getWorkPatchInvalidationTargets({ bookmarked: true }, smartCtx)).toEqual({
      facets: false,
      tags: false,
      resetActiveWorksList: true,
      patchActiveListCache: false,
      staleInactiveListCaches: true,
    });
  });

  it("空 PATCH では何もしない", () => {
    expect(getWorkPatchInvalidationTargets({}, baseCtx)).toEqual({
      facets: false,
      tags: false,
      resetActiveWorksList: false,
      patchActiveListCache: false,
      staleInactiveListCaches: false,
    });
  });
});
