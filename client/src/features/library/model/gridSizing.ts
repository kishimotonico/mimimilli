import { THUMBNAIL_WIDTHS } from "@mimimilli/shared";

export const MIN_TILE_SIZE = 100;
export const MAX_TILE_SIZE = 280;

export function clampTileSize(size: number): number {
  return Math.min(MAX_TILE_SIZE, Math.max(MIN_TILE_SIZE, Math.round(size)));
}

// shared の normalizeThumbnailWidth と違い、同距離なら高解像度側を選ぶ
// （表示品質を優先。サーバーへは常に許可幅そのものを送るので正規化の食い違いは起きない）
export function selectCoverThumbnailWidth(tileSize: number, devicePixelRatio: number): number {
  const target = clampTileSize(tileSize) * Math.max(1, devicePixelRatio);

  return [...THUMBNAIL_WIDTHS].reduce((nearest, width) =>
    Math.abs(width - target) <= Math.abs(nearest - target) ? width : nearest,
  );
}
