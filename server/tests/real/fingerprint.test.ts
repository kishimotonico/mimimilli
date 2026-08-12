// fingerprint.ts の normalize系（normalizeMetaContent/normalizeRawMetaContent/
// normalizeRawPlaylist/normalizeRawTrack/normalizeRawUrlEntry）は MetaFile の対象フィールドを
// 手動列挙している。shared/src/meta.ts 等のスキーマにフィールドが追加されても fingerprint.ts の
// 更新を忘れると、その項目の編集がスキャンに反映されないサイレント不整合になる（増分スキャン
// TASK-75 レビュー指摘）。
//
// ここではスキーマの `.shape` から導出したキー集合と、fingerprint.ts が対象にしているキー集合
// （このテストに手動転記した期待値）を突き合わせる。スキーマにフィールドが増減すればどちらかの
// 一致が崩れて失敗するため、fingerprint.ts側の更新漏れをこのテストが検知する。
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import {
  dlsiteStateSchema,
  metaFileSchema,
  playlistSchema,
  trackSchema,
  urlEntrySchema,
} from "@mimimilli/shared";
import {
  computeFingerprint,
  computeProjectionRevision,
  computeRawFingerprint,
} from "../../src/adapters/real/fingerprint.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

function keysOf(schema: { shape: Record<string, unknown> }): string[] {
  return Object.keys(schema.shape).sort();
}

test("metaFileSchemaのキー集合とfingerprintのnormalizeMetaContent対象が一致する", () => {
  // fingerprint.ts が意図的に対象外にしているキー（理由はそれぞれ）:
  //   - id: 作品を既存レコードと突き合わせる照合キーそのものであり、変更検知の対象ではない
  //   - createdAt: 機械的に変動しうるため対象外（fingerprint.ts冒頭コメント参照）
  const excluded = new Set(["id", "createdAt"]);
  const expectedTracked = [
    "title",
    "tags",
    "playlists",
    "defaultPlaylistId",
    "urls",
    "coverImage",
    "dlsite",
  ].sort();

  const schemaKeys = keysOf(metaFileSchema).filter((key) => !excluded.has(key));
  assert.deepEqual(
    schemaKeys,
    expectedTracked,
    "metaFileSchemaのフィールド増減に合わせて fingerprint.ts の normalizeMetaContent/" +
      "normalizeRawMetaContent と、このテストの期待値を更新してください",
  );
});

test("dlsiteStateSchemaのキー集合とfingerprintが対象にするdlsiteサブセットが一致する", () => {
  // lastAttemptAt / errorKind は機械的に変動しうる、またはサーバー付随情報のため対象外
  const excluded = new Set(["lastAttemptAt", "errorKind"]);
  const expectedTracked = ["appliedTags", "error", "rjCode", "status"].sort();

  const schemaKeys = keysOf(dlsiteStateSchema).filter((key) => !excluded.has(key));
  assert.deepEqual(
    schemaKeys,
    expectedTracked,
    "dlsiteStateSchemaのフィールド増減に合わせて fingerprint.ts の dlsite サブセットと、" +
      "このテストの期待値を更新してください",
  );
});

test("playlistSchema/trackSchema/urlEntrySchemaのキー集合はfingerprintが完全にカバーする（除外なし）", () => {
  assert.deepEqual(keysOf(playlistSchema), ["id", "name", "tracks"]);
  assert.deepEqual(keysOf(trackSchema), ["end", "file", "id", "start", "title"].sort());
  assert.deepEqual(keysOf(urlEntrySchema), ["label", "url"]);
});

test("errorKindを追加してもfingerprintは変わらない", (t) => {
  const directory = makeTestDirectory("fingerprint-errorKind");
  t.after(directory.cleanup);
  const metaPath = join(directory.path, "mimimilli.json");
  const legacyRaw = {
    formatVersion: 1,
    id: "00000000-0000-4000-8000-000000000001",
    title: "テスト作品",
    tags: [],
    playlists: [],
    defaultPlaylistId: null,
    urls: [],
    coverImage: null,
    dlsite: {
      rjCode: "RJ123456",
      status: "none",
      lastAttemptAt: null,
      error: null,
      appliedTags: [],
    },
  };
  const withErrorKindRaw = {
    ...legacyRaw,
    dlsite: { ...legacyRaw.dlsite, errorKind: "parse_error" },
  };
  const legacyFp = computeRawFingerprint(metaPath, legacyRaw);
  const withErrorKindFp = computeRawFingerprint(metaPath, withErrorKindRaw);
  assert.ok(legacyFp);
  assert.ok(withErrorKindFp);
  assert.equal(legacyFp.fingerprint, withErrorKindFp.fingerprint);

  const legacyMeta = metaFileSchema.parse(legacyRaw);
  const withErrorKindMeta = metaFileSchema.parse(withErrorKindRaw);
  assert.equal(
    computeFingerprint(metaPath, legacyMeta),
    computeFingerprint(metaPath, withErrorKindMeta),
  );
});

test("projection revisionは投影対象fieldだけを含みDLsiteの一時状態では変化しない", () => {
  const meta = metaFileSchema.parse({
    formatVersion: 1,
    id: "00000000-0000-4000-8000-000000000010",
    title: "テスト作品",
    playlists: [],
    dlsite: {
      rjCode: "RJ123456",
      status: "none",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: [],
    },
  });
  const transient = {
    ...meta,
    dlsite: {
      ...meta.dlsite,
      status: "error" as const,
      lastAttemptAt: "2026-08-12T00:00:00.000Z",
      error: "offline",
      errorKind: "offline" as const,
    },
  };
  assert.equal(computeProjectionRevision(meta), computeProjectionRevision(transient));
  assert.notEqual(
    computeProjectionRevision(meta),
    computeProjectionRevision({ ...meta, title: "更新" }),
  );
});
