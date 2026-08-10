import { selectNearestThumbnailWidth } from "@mimimilli/shared";
import { clampTileSize } from "../../../shared/lib/gridSizing";

// shared の normalizeThumbnailWidth と違い、同距離なら高解像度側を選ぶ
// （表示品質を優先。サーバーへは常に許可幅そのものを送るので正規化の食い違いは起きない）
export function selectCoverThumbnailWidth(tileSize: number, devicePixelRatio: number): number {
  const target = clampTileSize(tileSize) * Math.max(1, devicePixelRatio);
  return selectNearestThumbnailWidth(target);
}
