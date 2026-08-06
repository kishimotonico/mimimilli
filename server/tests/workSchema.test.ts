import assert from "node:assert/strict";
import { test } from "node:test";
import { metaFileSchema, tagSchema, trackSchema } from "@mimimilli/shared";

const PLAYLIST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TRACK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function validMeta() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "作品",
    playlists: [
      {
        id: PLAYLIST_ID,
        name: "default",
        tracks: [{ id: TRACK_ID, title: "本編", file: "track.wav", start: 1, end: 2 }],
      },
    ],
    defaultPlaylistId: PLAYLIST_ID,
  };
}

test("Track区間は有限値かつend > startである", () => {
  assert.equal(
    trackSchema.safeParse({ id: TRACK_ID, title: "t", file: "a.wav", start: 2, end: 2 }).success,
    false,
  );
  assert.equal(
    trackSchema.safeParse({ id: TRACK_ID, title: "t", file: "a.wav", end: Infinity }).success,
    false,
  );
});

test("Playlist ID・Track IDとdefaultPlaylistIdの不変条件を検証する", () => {
  const duplicate = validMeta();
  duplicate.playlists.push({
    id: PLAYLIST_ID,
    name: "default",
    tracks: [{ id: TRACK_ID, title: "重複", file: "other.wav", start: 0, end: 1 }],
  });
  const result = metaFileSchema.safeParse(duplicate);
  assert.equal(result.success, false);
  if (!result.success) {
    const paths = result.error.issues.map((issue) => issue.path.join("."));
    assert.ok(paths.includes("playlists.1.id"));
    assert.ok(paths.includes("playlists.1.tracks.0.id"));
  }

  assert.equal(
    metaFileSchema.safeParse({
      ...validMeta(),
      defaultPlaylistId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    }).success,
    false,
  );
});

test("dlsite.errorKindが無い旧metaはパースできerrorKindはnullになる", () => {
  const meta = {
    ...validMeta(),
    dlsite: {
      rjCode: "RJ123456",
      status: "none" as const,
      lastAttemptAt: null,
      error: null,
      appliedTags: [],
    },
  };
  const parsed = metaFileSchema.parse(meta);
  assert.equal(parsed.dlsite.errorKind, null);
});

test("dlsiteキー自体が無い旧metaはパースできerrorKindはnullになる", () => {
  const parsed = metaFileSchema.parse(validMeta());
  assert.equal(parsed.dlsite.errorKind, null);
});

test("タグは予約文字@始まりを拒否する", () => {
  assert.equal(tagSchema.safeParse("@year/2024").success, false);
  assert.equal(tagSchema.safeParse("year/2025").success, true);
  assert.equal(tagSchema.safeParse("cv/藤田茜").success, true);
});

test("予約文字の検証は正規化後の値に対して行われ、先頭空白では回避できない", () => {
  // normalizeTag は trim してから prefix を小文字化するため、生文字列のまま
  // startsWith("@") を見ると先頭空白で検証をすり抜けてしまう。
  assert.equal(tagSchema.safeParse(" @year/2024").success, false);
  assert.equal(tagSchema.safeParse("  @Year/2024").success, false);
  // annotated ではない（スラッシュ無し）flat タグも同様に検証する。
  assert.equal(tagSchema.safeParse(" @foo").success, false);
});

test("正規化後に空になるタグは黙って削除されず拒否される", () => {
  assert.equal(tagSchema.safeParse("").success, false);
  assert.equal(tagSchema.safeParse("   ").success, false);
  // annotated だが値が空白のみ（normalizeTag は prefix/値のどちらかが空なら空文字列を返す）。
  assert.equal(tagSchema.safeParse("cv/   ").success, false);
  assert.equal(tagSchema.safeParse("cv/藤田茜").success, true);
});

test("metaFileSchema.tags でも予約文字の検証が効き、先頭空白では回避できない", () => {
  const withReservedTag = { ...validMeta(), tags: ["cv/藤田茜", " @year/2024"] };
  assert.equal(metaFileSchema.safeParse(withReservedTag).success, false);

  const withNormalTags = { ...validMeta(), tags: [" CV/藤田茜 ", "cv/藤田茜"] };
  const parsed = metaFileSchema.parse(withNormalTags);
  // dedupeTags(normalizeTags(...)) で正規化・重複排除される。
  assert.deepEqual(parsed.tags, ["cv/藤田茜"]);
});

test("metaFileSchema.dlsite.appliedTags は正規化されていないタグを拒否する", () => {
  const withBadAppliedTags = {
    ...validMeta(),
    dlsite: {
      rjCode: "RJ123456",
      status: "applied" as const,
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: [" CV/壊れ "],
    },
  };
  assert.equal(metaFileSchema.safeParse(withBadAppliedTags).success, false);
});

test("同名Playlistは異なるIDなら許容する", () => {
  const meta = validMeta();
  meta.playlists.push({
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "default",
    tracks: [
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        title: "別版",
        file: "other.wav",
        start: 0,
        end: 1,
      },
    ],
  });
  assert.equal(metaFileSchema.safeParse(meta).success, true);
});
