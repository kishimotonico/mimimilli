import type { AxisFacetItem } from "@mimimilli/shared";
import { getCoverImageUrl } from "../../../entities/work/api";
import { I, type IconName } from "../../../shared/ui/Icon";

// 値一覧の代表カバー 2×2 コラージュ（ADR-0012 §5）。grid タイル・list 行（32px）の両方で使う
// 共有部品（TASK-182 のオーバーレイからも再利用できるよう独立させる）。

interface CoverCollageProps {
  covers: AxisFacetItem["covers"];
  /** px指定なら固定サイズ（list行32pxなど）。省略時はCSS側（100%+aspect-ratio）に任せる（grid タイル用） */
  size?: number;
  radius?: number;
  /** 代表カバーが0件のときに中央へ置く軸アイコン */
  fallbackIcon: IconName;
  requestWidth?: number;
}

export default function CoverCollage({
  covers,
  size,
  radius = 4,
  fallbackIcon,
  requestWidth,
}: CoverCollageProps) {
  const Fallback = I[fallbackIcon];
  const sizeStyle = size === undefined ? {} : { width: size, height: size };

  if (covers.length === 0) {
    return (
      <div
        className="mll-collage mll-collage--empty"
        style={{ ...sizeStyle, borderRadius: radius }}
      >
        <Fallback size={size === undefined ? 24 : Math.round(size * 0.4)} />
      </div>
    );
  }

  const cells = Array.from({ length: 4 }, (_, i) => covers[i] ?? null);

  return (
    <div className="mll-collage" style={{ ...sizeStyle, borderRadius: radius }}>
      {cells.map((cover, i) => (
        <div key={cover?.workId ?? `empty-${i}`} className="mll-collage__cell">
          {cover && (
            <img src={getCoverImageUrl(cover.workId, requestWidth)} alt="" loading="lazy" />
          )}
        </div>
      ))}
    </div>
  );
}
