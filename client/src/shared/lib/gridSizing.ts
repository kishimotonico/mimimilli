export const MIN_TILE_SIZE = 100;
export const MAX_TILE_SIZE = 280;

export function clampTileSize(size: number): number {
  return Math.min(MAX_TILE_SIZE, Math.max(MIN_TILE_SIZE, Math.round(size)));
}

// JS/CSS間の値のずれを防ぐため、WorkGrid が --grid-row-gap / --grid-col-gap /
// --tile-chrome-h として shell.css の .mll-grid* 規則へ注入する。値を変える場合は
// この定数だけを更新すればよい（shell.css 側に数値を直書きしない）。

/** タイル間の縦gap（行間） */
export const GRID_ROW_GAP = 18;
/** タイル間の横gap（列間・行内） */
export const GRID_COLUMN_GAP = 14;
/** タイルのカバー以外の高さ（パディング＋タイトル＋サークル名）。
 *  content-visibility:auto のプレースホルダーサイズ算出にのみ使う概算値 */
export const GRID_TILE_CHROME_HEIGHT = 58;

// 1:1タイルの列数を「実寸がスライダー目標値に最も近くなる」基準で選ぶ。
// CSSの auto-fill+minmax(size,1fr) は「目標幅を下回らない最大列数」を選ぶため、
// 列数が切り替わる境界でタイル実寸が目標値から大きく飛ぶ（例: 3列ギリギリで
// 収まらなくなった瞬間に2列へ落ち、タイルが一気に太る）。ここでは
// containerWidth = N*width + (N-1)*gap を width=target について解いた
// N = (containerWidth + gap) / (target + gap) を四捨五入することで、
// 切り替わり後の実寸が常に目標値の近傍に収まるようにする（列数の切り替わり自体は
// 整数である以上避けられないが、体感のジャンプ幅を最小化できる）。
// 実寸が MIN/MAX_TILE_SIZE を多少下回る/上回ることは許容する（連続性を優先）。
export function computeGridColumnCount(
  containerWidth: number,
  targetTileSize: number,
  gap: number = GRID_COLUMN_GAP,
): number {
  if (containerWidth <= 0) return 1;
  const target = clampTileSize(targetTileSize);
  const raw = (containerWidth + gap) / (target + gap);
  return Math.max(1, Math.round(raw));
}
