// 原寸（ジャスティファイド）グリッドの行組みアルゴリズム（TASK-45）。
// 「行の目標高さに向かって貪欲にアイテムを敷き詰め、行が目標幅に達したら
// 実際の行幅にぴったり合うよう高さを微調整する」という Flickr の
// justified-layout 相当の手法を簡略化したもの。
//
// 出力は各タイルの「幅」と「どの行に属すか」のみで、x/y の絶対座標は返さない。
// 実際の横並び・行の縦積みは WorkGrid 側で flexbox（各行 = display:flex な
// div、グリッド全体 = display:flex; flex-direction:column）に委ねる方が
// シンプルかつ堅牢（gapや端数のズレをブラウザのレイアウトエンジンに任せられる）。
// ただし、キーボードナビ（gridNavigation.ts の getNextJustifiedIndex）が
// 「上下の行で横位置が最も近いタイル」を選ぶために、DOM計測なしで済むよう
// 各タイルの行内中心x座標（centerX）だけはここで計算して返す。

export interface JustifiedItemInput {
  readonly id: string;
  /** 画像の 幅/高さ。0以下や非数（未計測・NaN）は 1（正方形）として扱う */
  readonly aspectRatio: number;
}

export interface JustifiedTile {
  readonly id: string;
  readonly width: number;
  readonly rowIndex: number;
  /** キーボードナビの上下移動でのみ使用する、行内でのタイル中心x座標（px） */
  readonly centerX: number;
}

export interface JustifiedLayout {
  /** 入力 items と同じ順序・同じ長さ */
  readonly tiles: readonly JustifiedTile[];
  /** 各行の画像高さ（px）。rowIndex でインデックスする */
  readonly rowHeights: readonly number[];
}

export interface JustifiedLayoutOptions {
  readonly containerWidth: number;
  readonly targetRowHeight: number;
  /** 行内のタイル間の横gap（px）。行間の縦gapはCSS側（flexboxのgap）に委ねるためここでは扱わない */
  readonly gap: number;
}

// 極端な縦長・横長の画像1枚が行の高さを壊さないためのクランプ。
// DLsiteのカバーは概ね1:1〜4:3に収まるため、実用上ここに掛かるのは異常値のみ。
const MIN_ASPECT_RATIO = 0.4;
const MAX_ASPECT_RATIO = 3;

function normalizeAspectRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, ratio));
}

export function computeJustifiedLayout(
  items: readonly JustifiedItemInput[],
  { containerWidth, targetRowHeight, gap }: JustifiedLayoutOptions,
): JustifiedLayout {
  if (items.length === 0 || containerWidth <= 0 || targetRowHeight <= 0) {
    return { tiles: [], rowHeights: [] };
  }

  const tiles: JustifiedTile[] = [];
  const rowHeights: number[] = [];
  let row: { id: string; ratio: number }[] = [];
  let rowRatioSum = 0;

  const flushRow = (stretch: boolean) => {
    if (row.length === 0) return;

    const gapsWidth = gap * (row.length - 1);
    // stretch: 行幅ぴったりに高さを微調整する（通常行、および目標高さのままでも
    // 行幅を満たす／超える最終行）。それ以外（目標高さのままでは行幅に届かない
    // 最終行）は無理に伸ばさず目標高さのまま左寄せで終える。
    const rowHeight = stretch ? (containerWidth - gapsWidth) / rowRatioSum : targetRowHeight;

    const rowIndex = rowHeights.length;
    let x = 0;
    for (const entry of row) {
      const width = rowHeight * entry.ratio;
      tiles.push({ id: entry.id, width, rowIndex, centerX: x + width / 2 });
      x += width + gap;
    }
    rowHeights.push(rowHeight);
    row = [];
    rowRatioSum = 0;
  };

  items.forEach((item, index) => {
    const ratio = normalizeAspectRatio(item.aspectRatio);
    row.push({ id: item.id, ratio });
    rowRatioSum += ratio;

    const gapsWidth = gap * (row.length - 1);
    const widthAtTarget = rowRatioSum * targetRowHeight + gapsWidth;
    const isLastItem = index === items.length - 1;

    if (widthAtTarget >= containerWidth) {
      flushRow(true);
    } else if (isLastItem) {
      flushRow(false);
    }
  });

  return { tiles, rowHeights };
}
