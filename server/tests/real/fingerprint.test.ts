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
import { test } from "node:test";
import {
  dlsiteStateSchema,
  metaFileSchema,
  playlistSchema,
  trackSchema,
  urlEntrySchema,
} from "@mimimilli/shared";

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
  // lastAttemptAt は機械的に変動するため対象外（fingerprint.ts冒頭コメント参照）
  const excluded = new Set(["lastAttemptAt"]);
  const expectedTracked = ["rjCode", "status", "error", "appliedTags"].sort();

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
