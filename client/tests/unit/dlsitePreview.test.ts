import { describe, expect, it } from "vitest";
import {
  dlsiteInfoTags,
  emptyDlsiteState,
  type DlsiteWorkInfo,
  type Work,
} from "@mimimilli/shared";
import {
  buildDlsiteApplyBody,
  computeDlsiteApplyDiff,
  unappliedDlsiteTags,
} from "../../src/entities/work/dlsitePreview";

const info: DlsiteWorkInfo = {
  rjCode: "RJ123456",
  title: "取得タイトル",
  circle: "夜想曲",
  cvs: ["水瀬なずな"],
  genreTags: ["耳かき", "睡眠"],
  ageRating: "R15",
  coverUrl: "https://example.test/cover.jpg",
  url: "https://example.test/RJ123456",
};

const work = {
  id: "work-1",
  title: "現在タイトル",
  cover: null,
  coverKind: "none",
  coverImage: null,
  status: "ok",
  physicalPath: "/lib/work-1",
  totalDurationSec: 0,
  addedAt: "2026-01-01T00:00:00.000Z",
  errorMessage: null,
  urls: [],
  tags: ["サークル/夜想曲"],
  bookmarked: false,
  lastPlayedAt: null,
  dlsite: emptyDlsiteState(),
  defaultPlaylistId: null,
  createdAt: null,
  playlists: [],
  resume: null,
} satisfies Work;

describe("DLsite適用プレビュー", () => {
  it("情報を正規形タグへ変換し、適用済みタグを候補から除く", () => {
    expect(dlsiteInfoTags(info)).toEqual([
      "サークル/夜想曲",
      "cv/水瀬なずな",
      "genre/耳かき",
      "genre/睡眠",
      "rating/R15",
    ]);
    expect(unappliedDlsiteTags(work, info)).toEqual([
      "cv/水瀬なずな",
      "genre/耳かき",
      "genre/睡眠",
      "rating/R15",
    ]);
  });

  it("変更あり・変更なし・適用不可を行ごとに区別する", () => {
    const sameTitleInfo: DlsiteWorkInfo = { ...info, title: work.title, coverUrl: null };
    const diff = computeDlsiteApplyDiff(work, sameTitleInfo);
    expect(diff.title).toEqual({ kind: "unchanged", value: work.title });
    expect(diff.url).toEqual({ kind: "changed", current: "未設定", next: sameTitleInfo.url });
    expect(diff.cover).toEqual({
      kind: "unavailable",
      current: "なし",
      reason: "DLsiteに画像がありません",
    });
    expect(diff.newTags).toEqual(["cv/水瀬なずな", "genre/耳かき", "genre/睡眠", "rating/R15"]);
    expect(diff.appliedTags).toEqual(["サークル/夜想曲"]);
    expect(diff.hasChanges).toBe(true);
  });

  it("差分が無ければhasChangesがfalseになる", () => {
    const noChangeInfo: DlsiteWorkInfo = {
      ...info,
      title: work.title,
      circle: "夜想曲",
      cvs: [],
      genreTags: [],
      ageRating: null,
      coverUrl: null,
      url: "",
    };
    expect(computeDlsiteApplyDiff(work, noChangeInfo).hasChanges).toBe(false);
  });

  it("タイトル・カバーと選択タグだけをapply bodyへ入れる", () => {
    expect(
      buildDlsiteApplyBody(info, {
        sourceRevision: "revision-1",
        applyTitle: false,
        applyCover: true,
        applyUrl: true,
        applyTags: ["Genre/ 耳かき ", "genre/耳かき"],
      }),
    ).toEqual({
      info,
      sourceRevision: "revision-1",
      applyTitle: false,
      applyCover: true,
      applyUrl: true,
      applyTags: ["genre/耳かき"],
    });
  });
});
