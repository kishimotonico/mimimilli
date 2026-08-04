import { describe, expect, it } from "vitest";
import { emptyDlsiteState, type Work } from "@mimimilli/shared";
import {
  getWorkPatchInvalidationTargets,
  mergeWorkPatchResponse,
  type IfEquals,
  type LibraryListContext,
} from "../../src/features/library/model/workPatchInvalidation";

const baseCtx: LibraryListContext = {
  activeAxis: "all",
  sort: "added-desc",
  searchQuery: "",
  selectedTags: [],
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

  it("タグ変更（tag 軸の値一覧を表示中。作品一覧を持たないためアクティブ一覧には影響しない）", () => {
    expect(
      getWorkPatchInvalidationTargets(
        { tags: ["ASMR"] },
        { ...baseCtx, activeAxis: "tag", selectedTags: ["ASMR"] },
      ),
    ).toEqual({
      facets: true,
      tags: true,
      resetActiveWorksList: false,
      patchActiveListCache: true,
      staleInactiveListCaches: true,
    });
  });

  it("タグ変更（facet 軸で値を選択中）はアクティブ reset", () => {
    expect(
      getWorkPatchInvalidationTargets(
        { tags: ["cv/水瀬なずな"] },
        { ...baseCtx, activeAxis: "all", selectedTags: ["cv/水瀬なずな"] },
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

function makeWork(overrides: Partial<Work> = {}): Work {
  const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  return {
    id: "w1",
    title: "元のタイトル",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/lib/w1",
    totalDurationSec: 60,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: ["元タグ"],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [{ id: playlistId, name: "default", tracks: [] }],
    resume: { playlistId, trackId: "t1", offsetSec: 123 },
    ...overrides,
  };
}

describe("mergeWorkPatchResponse", () => {
  it("bodyで指定していないフィールド（resume）はレスポンスの値ではなく既存キャッシュの値を維持する", () => {
    const prev = makeWork({ resume: { playlistId: "p", trackId: "t1", offsetSec: 1 } });
    const response = makeWork({
      bookmarked: true,
      resume: { playlistId: "p", trackId: "t1", offsetSec: 5025 }, // サーバー側で進んだ経過時間
    });
    const merged = mergeWorkPatchResponse(prev, { bookmarked: true }, response);
    expect(merged.bookmarked).toBe(true); // bodyが指定したフィールドはレスポンスの値
    expect(merged.resume).toEqual(prev.resume); // 指定していないフィールドは既存キャッシュを維持
  });

  it("titleを指定したPATCHではtitleのみレスポンスの値を取り込む", () => {
    const prev = makeWork({ title: "旧タイトル", tags: ["旧タグ"] });
    const response = makeWork({ title: "新タイトル", tags: ["旧タグ"] });
    const merged = mergeWorkPatchResponse(prev, { title: "新タイトル" }, response);
    expect(merged.title).toBe("新タイトル");
    expect(merged.tags).toEqual(prev.tags);
    expect(merged.resume).toEqual(prev.resume);
  });

  it("tagsを指定したPATCHではtagsのみレスポンスの値を取り込む", () => {
    const prev = makeWork({ tags: ["旧タグ"] });
    const response = makeWork({ tags: ["新タグ"] });
    const merged = mergeWorkPatchResponse(prev, { tags: ["新タグ"] }, response);
    expect(merged.tags).toEqual(["新タグ"]);
    expect(merged.resume).toEqual(prev.resume);
  });

  it("既存キャッシュが無ければレスポンスをそのまま採用する", () => {
    const response = makeWork({ bookmarked: true });
    expect(mergeWorkPatchResponse(undefined, { bookmarked: true }, response)).toEqual(response);
  });

  it("複数フィールドを同時に指定したPATCHでは指定した分だけ取り込む", () => {
    const prev = makeWork({ title: "旧", tags: ["旧タグ"], bookmarked: false });
    const response = makeWork({ title: "新", tags: ["新タグ"], bookmarked: true });
    const merged = mergeWorkPatchResponse(
      prev,
      { title: "新", tags: ["新タグ"], bookmarked: true },
      response,
    );
    expect(merged.title).toBe("新");
    expect(merged.tags).toEqual(["新タグ"]);
    expect(merged.bookmarked).toBe(true);
    expect(merged.resume).toEqual(prev.resume);
  });

  // mergeWorkPatchResponse内部の網羅性チェック（WORK_PATCH_KEYSとkeyof WorkPatchの
  // 一致をIfEqualsで強制する仕組み）が実際に機能することを示すデモ。WorkPatch相当の
  // 架空の契約に対して「キー列挙の更新を忘れた」状態を再現し、IfEqualsがnever
  // （不一致）になって代入がコンパイルエラーになることを確認する。本物のWorkPatch
  // に契約変更が入ったとき、workPatchInvalidation.ts側のWORK_PATCH_KEYSの更新を
  // 忘れると、これと同じ理屈でpnpm checkのtscが落ちる。
  it("IfEqualsによる網羅性チェックはキー列挙の更新漏れを型エラーとして検出する", () => {
    interface FakeWorkPatch {
      title?: string;
      tags?: string[];
      // bookmarked に相当する新フィールドが増えたのに、下のFAKE_KEYS側の
      // 更新を忘れたケースを模す。
      bookmarked?: boolean;
    }
    const FAKE_KEYS = ["title", "tags"] as const satisfies readonly (keyof FakeWorkPatch)[];
    type FakeKeysAreExhaustive = IfEquals<(typeof FAKE_KEYS)[number], keyof FakeWorkPatch>;
    // @ts-expect-error -- bookmarkedがFAKE_KEYSに列挙されておらずIfEqualsはneverに
    // なるため、true を代入できない（=更新漏れがコンパイルエラーとして検出される）。
    const fakeKeysAreExhaustive: FakeKeysAreExhaustive = true;
    expect(fakeKeysAreExhaustive).toBe(true);
  });
});
