import { describe, expect, it } from "vitest";
import { emptyDlsiteState, type DlsiteWorkInfo, type Work } from "@mimimilli/shared";
import {
  buildDlsiteApplyBody,
  dlsiteInfoTags,
  unappliedDlsiteTags,
} from "../../src/entities/work/dlsitePreview";

const info: DlsiteWorkInfo = {
  rjCode: "RJ123456",
  title: "取得タイトル",
  circle: "夜想曲",
  cvs: ["水瀬なずな"],
  genreTags: ["耳かき", "睡眠"],
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
    ]);
    expect(unappliedDlsiteTags(work, info)).toEqual([
      "cv/水瀬なずな",
      "genre/耳かき",
      "genre/睡眠",
    ]);
  });

  it("タイトル・カバーと選択タグだけをapply bodyへ入れる", () => {
    expect(
      buildDlsiteApplyBody(info, {
        applyTitle: false,
        applyCover: true,
        applyTags: ["Genre/ 耳かき ", "genre/耳かき"],
      }),
    ).toEqual({ info, applyTitle: false, applyCover: true, applyTags: ["genre/耳かき"] });
  });
});
