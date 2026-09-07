import { atomWithStorage } from "jotai/utils";

/** プレビュー幅のクランプ範囲（px）。上限はDragHandle側で更に「一覧の最小幅を侵さない」制約を重ねる */
export const FILES_PREVIEW_WIDTH_MIN = 320;
export const FILES_PREVIEW_WIDTH_MAX = 720;
export const FILES_PREVIEW_WIDTH_DEFAULT = 420;

/** ファイルプレビュー幅。ドラッグリサイズの確定値を localStorage へ保存し、次回起動時も復元する */
export const filesPreviewWidthAtom = atomWithStorage<number>(
  "mimimilli:filesPreviewWidth",
  FILES_PREVIEW_WIDTH_DEFAULT,
);

/** プレビューの開閉状態。閉じている間は一覧が全幅を使う */
export const filesPreviewOpenAtom = atomWithStorage<boolean>("mimimilli:filesPreviewOpen", true);

export function clampFilesPreviewWidth(width: number): number {
  return Math.min(FILES_PREVIEW_WIDTH_MAX, Math.max(FILES_PREVIEW_WIDTH_MIN, width));
}
