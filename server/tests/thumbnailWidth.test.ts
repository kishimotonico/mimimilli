// normalizeThumbnailWidth（@mimimilli/shared）の最近傍丸め挙動の単体テスト。
// 許可幅は THUMBNAIL_WIDTHS = [128, 256, 512] の離散値のみ。
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeThumbnailWidth } from "@mimimilli/shared";

test("normalizeThumbnailWidth: 許可幅そのものはそのまま返す", () => {
  assert.equal(normalizeThumbnailWidth(128), 128);
  assert.equal(normalizeThumbnailWidth(256), 256);
  assert.equal(normalizeThumbnailWidth(512), 512);
});

test("normalizeThumbnailWidth: 許可幅の間は最近傍へ丸める", () => {
  assert.equal(normalizeThumbnailWidth(150), 128); // |150-128|=22 < |150-256|=106
  assert.equal(normalizeThumbnailWidth(200), 256); // |200-128|=72 > |200-256|=56
  assert.equal(normalizeThumbnailWidth(400), 512); // |400-256|=144 > |400-512|=112
});

test("normalizeThumbnailWidth: ちょうど中間（同距離）は小さい側へ丸める", () => {
  // 128 と 256 の中間は 192（距離64ずつ）
  assert.equal(normalizeThumbnailWidth(192), 128);
  // 256 と 512 の中間は 384（距離128ずつ）
  assert.equal(normalizeThumbnailWidth(384), 256);
});

test("normalizeThumbnailWidth: 範囲外（極端に小さい/大きい）でも最も近い許可幅に収める", () => {
  assert.equal(normalizeThumbnailWidth(1), 128);
  assert.equal(normalizeThumbnailWidth(10000), 512);
});
