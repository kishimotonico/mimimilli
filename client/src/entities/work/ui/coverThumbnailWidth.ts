import { THUMBNAIL_WIDTHS, type ThumbnailWidth } from "@mimimilli/shared";

/** 固定サイズでカバーを表示するときに要求するサムネイル幅を返す。
 *  表示サイズ×DPR 以上の最小の許可幅を選ぶ（ceil方式: アップスケールによるぼやけを防ぐ）。
 *  どの許可幅でも足りない場合は最大幅を返す。 */
export function selectFixedCoverThumbnailWidth(
  displaySize: number,
  devicePixelRatio: number,
): ThumbnailWidth {
  const target = displaySize * Math.max(1, devicePixelRatio);
  const fallback = THUMBNAIL_WIDTHS[THUMBNAIL_WIDTHS.length - 1];
  if (fallback === undefined) throw new Error("THUMBNAIL_WIDTHS must not be empty");
  return THUMBNAIL_WIDTHS.find((width) => width >= target) ?? fallback;
}
