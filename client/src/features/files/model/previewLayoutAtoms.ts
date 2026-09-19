import { atomWithStorage } from "jotai/utils";

/** プレビュー幅のクランプ範囲（px） */
export const FILES_PREVIEW_WIDTH_MIN = 320;
export const FILES_PREVIEW_WIDTH_MAX = 720;
export const FILES_PREVIEW_WIDTH_DEFAULT = 420;

/** 一覧（.mle-filestage、files-c.cssの min-width）が確保する最小幅。
 *  プレビューの実効上限はコンテナ幅からこの分を引いた値にする（useFilePreviewResize.ts）。 */
export const FILES_LIST_MIN_WIDTH = 260;

/** ファイルプレビュー幅。ドラッグリサイズの確定値を localStorage へ保存し、次回起動時も復元する */
export const filesPreviewWidthAtom = atomWithStorage<number>(
  "mimimilli:filesPreviewWidth",
  FILES_PREVIEW_WIDTH_DEFAULT,
);

/** プレビューの開閉状態。閉じている間は一覧が全幅を使う */
export const filesPreviewOpenAtom = atomWithStorage<boolean>("mimimilli:filesPreviewOpen", true);

/** max はコンテナ幅から一覧の最小幅を引いた実効上限（呼び出し側が算出）。
 *  省略時は固定上限 FILES_PREVIEW_WIDTH_MAX を使う。 */
export function clampFilesPreviewWidth(
  width: number,
  max: number = FILES_PREVIEW_WIDTH_MAX,
): number {
  return Math.min(max, Math.max(FILES_PREVIEW_WIDTH_MIN, width));
}

/** コンテナ幅（一覧+プレビューの合計）から、一覧の最小幅を侵さないプレビュー幅の実効上限を求める。
 *  コンテナ幅が未測定（null）の間は固定上限をそのまま使う。 */
export function getEffectiveFilesPreviewWidthMax(containerWidth: number | null): number {
  if (containerWidth === null) return FILES_PREVIEW_WIDTH_MAX;
  return Math.min(
    FILES_PREVIEW_WIDTH_MAX,
    Math.max(FILES_PREVIEW_WIDTH_MIN, containerWidth - FILES_LIST_MIN_WIDTH),
  );
}
